
-- ============ wallet_topups (audit log for every credit) ============
CREATE TABLE IF NOT EXISTS public.wallet_topups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  amount_cents integer NOT NULL,                  -- net credited to wallet
  gross_cents integer NOT NULL DEFAULT 0,         -- what the user paid (pre-Stripe-fee)
  fee_cents integer NOT NULL DEFAULT 0,           -- Stripe / processor fee
  source text NOT NULL DEFAULT 'stripe',          -- stripe | admin | promo | refund | referral
  stripe_session_id text,
  stripe_payment_intent text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wallet_topups_user_idx ON public.wallet_topups(user_id, created_at DESC);
ALTER TABLE public.wallet_topups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own topups" ON public.wallet_topups;
CREATE POLICY "Users view own topups" ON public.wallet_topups FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_owner());
DROP POLICY IF EXISTS "Owner manages topups" ON public.wallet_topups;
CREATE POLICY "Owner manages topups" ON public.wallet_topups FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- ============ wallet_limits (per-user safety rails) ============
CREATE TABLE IF NOT EXISTS public.wallet_limits (
  user_id uuid PRIMARY KEY,
  min_balance_cents integer NOT NULL DEFAULT 0,        -- floor (0 = no overdraft)
  daily_spend_cap_cents integer NOT NULL DEFAULT 5000, -- $50/day default
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallet_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own limits" ON public.wallet_limits;
CREATE POLICY "Users view own limits" ON public.wallet_limits FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.is_owner());
DROP POLICY IF EXISTS "Owner manages limits" ON public.wallet_limits;
CREATE POLICY "Owner manages limits" ON public.wallet_limits FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- ============ margin_alerts ============
CREATE TABLE IF NOT EXISTS public.margin_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  revenue_cents bigint NOT NULL,
  est_provider_cost_cents bigint NOT NULL,
  margin_pct numeric NOT NULL,
  threshold_pct numeric NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.margin_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owner manages margin alerts" ON public.margin_alerts;
CREATE POLICY "Owner manages margin alerts" ON public.margin_alerts FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());

-- ============ wallet_topup() — log every credit ============
CREATE OR REPLACE FUNCTION public.wallet_topup(_user_id uuid, _amount_cents integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new_balance integer;
BEGIN
  INSERT INTO public.wallet_balances (user_id, balance_cents)
  VALUES (_user_id, _amount_cents)
  ON CONFLICT (user_id) DO UPDATE
    SET balance_cents = public.wallet_balances.balance_cents + _amount_cents,
        updated_at = now()
  RETURNING balance_cents INTO v_new_balance;

  INSERT INTO public.wallet_topups (user_id, amount_cents, gross_cents, source, metadata)
  VALUES (_user_id, _amount_cents, _amount_cents, 'system', jsonb_build_object('via','wallet_topup'));

  RETURN v_new_balance;
END;
$$;

-- Richer version Stripe webhook etc. can call with full breakdown
CREATE OR REPLACE FUNCTION public.wallet_topup_logged(
  _user_id uuid, _amount_cents integer, _gross_cents integer, _fee_cents integer,
  _source text, _stripe_session_id text DEFAULT NULL, _stripe_payment_intent text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_new_balance integer;
BEGIN
  INSERT INTO public.wallet_balances (user_id, balance_cents)
  VALUES (_user_id, _amount_cents)
  ON CONFLICT (user_id) DO UPDATE
    SET balance_cents = public.wallet_balances.balance_cents + _amount_cents,
        updated_at = now()
  RETURNING balance_cents INTO v_new_balance;

  INSERT INTO public.wallet_topups (user_id, amount_cents, gross_cents, fee_cents, source, stripe_session_id, stripe_payment_intent, metadata)
  VALUES (_user_id, _amount_cents, COALESCE(_gross_cents, _amount_cents), COALESCE(_fee_cents, 0),
          COALESCE(NULLIF(trim(_source),''), 'stripe'),
          _stripe_session_id, _stripe_payment_intent, COALESCE(_metadata,'{}'::jsonb));

  RETURN v_new_balance;
END;
$$;

-- ============ wallet_charge_ai() — enforce min balance + daily cap ============
CREATE OR REPLACE FUNCTION public.wallet_charge_ai(
  _user_id uuid, _service text, _provider_cost_cents integer, _platform_fee_cents integer,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(charge_id uuid, total_billed_cents integer, new_balance_cents integer, insufficient boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_total integer := GREATEST(1, COALESCE(_provider_cost_cents,0) + COALESCE(_platform_fee_cents,0));
  v_balance integer;
  v_charge_id uuid;
  v_unlimited boolean;
  v_meta jsonb;
  v_min_balance integer;
  v_daily_cap integer;
  v_today_spent integer;
BEGIN
  v_unlimited := public.has_unlimited_ai(_user_id);

  INSERT INTO public.wallet_balances (user_id, balance_cents) VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Pull (or default) limits
  SELECT min_balance_cents, daily_spend_cap_cents INTO v_min_balance, v_daily_cap
  FROM public.wallet_limits WHERE user_id = _user_id;
  v_min_balance := COALESCE(v_min_balance, 0);
  v_daily_cap := COALESCE(v_daily_cap, 5000);

  -- Enforce daily cap (admins bypass)
  IF NOT v_unlimited THEN
    SELECT COALESCE(SUM(total_cents),0) INTO v_today_spent
    FROM public.ai_charges
    WHERE user_id = _user_id AND created_at >= (now() AT TIME ZONE 'utc')::date;
    IF v_today_spent + v_total > v_daily_cap THEN
      SELECT balance_cents INTO v_balance FROM public.wallet_balances WHERE user_id = _user_id;
      RETURN QUERY SELECT NULL::uuid, v_total, COALESCE(v_balance,0), TRUE;
      RETURN;
    END IF;
  END IF;

  SELECT balance_cents INTO v_balance FROM public.wallet_balances WHERE user_id = _user_id FOR UPDATE;

  IF NOT v_unlimited AND (v_balance - v_total) < v_min_balance THEN
    RETURN QUERY SELECT NULL::uuid, v_total, v_balance, TRUE;
    RETURN;
  END IF;

  IF NOT v_unlimited THEN
    UPDATE public.wallet_balances SET balance_cents = balance_cents - v_total, updated_at = now()
      WHERE user_id = _user_id RETURNING balance_cents INTO v_balance;
  END IF;

  v_meta := COALESCE(_metadata,'{}'::jsonb) || jsonb_build_object('unlimited_bypass', v_unlimited);

  INSERT INTO public.ai_charges (user_id, service, provider_cost_cents, platform_fee_cents, total_cents, metadata)
  VALUES (_user_id, _service, COALESCE(_provider_cost_cents,0), COALESCE(_platform_fee_cents,0),
          CASE WHEN v_unlimited THEN 0 ELSE v_total END, v_meta)
  RETURNING id INTO v_charge_id;

  RETURN QUERY SELECT v_charge_id, CASE WHEN v_unlimited THEN 0 ELSE v_total END, v_balance, FALSE;
END;
$$;

-- ============ Provider P&L summary ============
CREATE OR REPLACE FUNCTION public.provider_pnl_summary(_days integer DEFAULT 30)
RETURNS TABLE(
  service text,
  charges_count bigint,
  revenue_cents bigint,
  provider_cost_cents bigint,
  platform_fee_cents bigint,
  margin_pct numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COALESCE(NULLIF(service,''),'unknown') AS service,
    COUNT(*)::bigint,
    COALESCE(SUM(total_cents),0)::bigint AS revenue_cents,
    COALESCE(SUM(provider_cost_cents),0)::bigint AS provider_cost_cents,
    COALESCE(SUM(platform_fee_cents),0)::bigint AS platform_fee_cents,
    CASE WHEN COALESCE(SUM(total_cents),0) > 0
      THEN ROUND( ((SUM(total_cents) - SUM(provider_cost_cents))::numeric / SUM(total_cents)::numeric) * 100, 2)
      ELSE 0 END AS margin_pct
  FROM public.ai_charges
  WHERE created_at >= now() - make_interval(days => GREATEST(1, _days))
    AND public.is_owner()
  GROUP BY 1
  ORDER BY revenue_cents DESC;
$$;

-- ============ Per-user usage breakdown ============
CREATE OR REPLACE FUNCTION public.user_usage_breakdown(_days integer DEFAULT 30, _limit integer DEFAULT 50)
RETURNS TABLE(
  user_id uuid,
  user_email text,
  total_generations bigint,
  total_spent_cents bigint,
  services jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, auth AS $$
  SELECT
    c.user_id,
    u.email::text,
    COUNT(*)::bigint AS total_generations,
    COALESCE(SUM(c.total_cents),0)::bigint AS total_spent_cents,
    jsonb_object_agg(COALESCE(NULLIF(c.service,''),'unknown'), svc.cnt) AS services
  FROM public.ai_charges c
  LEFT JOIN auth.users u ON u.id = c.user_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS cnt
    FROM public.ai_charges c2
    WHERE c2.user_id = c.user_id AND c2.service = c.service
      AND c2.created_at >= now() - make_interval(days => GREATEST(1,_days))
  ) svc ON true
  WHERE c.created_at >= now() - make_interval(days => GREATEST(1, _days))
    AND public.is_owner()
  GROUP BY c.user_id, u.email
  ORDER BY total_spent_cents DESC
  LIMIT GREATEST(1, _limit);
$$;

-- ============ Margin alert checker (callable by cron) ============
CREATE OR REPLACE FUNCTION public.check_margin_and_alert(_threshold_pct numeric DEFAULT 15, _days integer DEFAULT 1)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_revenue bigint; v_cost bigint; v_margin numeric; v_alert_id uuid;
  v_start timestamptz := now() - make_interval(days => GREATEST(1,_days));
BEGIN
  SELECT COALESCE(SUM(total_cents),0), COALESCE(SUM(provider_cost_cents),0)
    INTO v_revenue, v_cost
  FROM public.ai_charges WHERE created_at >= v_start;

  IF v_revenue <= 0 THEN RETURN NULL; END IF;
  v_margin := ROUND(((v_revenue - v_cost)::numeric / v_revenue::numeric) * 100, 2);

  IF v_margin < _threshold_pct THEN
    INSERT INTO public.margin_alerts (period_start, period_end, revenue_cents, est_provider_cost_cents, margin_pct, threshold_pct,
      severity)
    VALUES (v_start, now(), v_revenue, v_cost, v_margin, _threshold_pct,
      CASE WHEN v_margin < 0 THEN 'critical' WHEN v_margin < _threshold_pct/2 THEN 'high' ELSE 'warning' END)
    RETURNING id INTO v_alert_id;
  END IF;
  RETURN v_alert_id;
END;
$$;
