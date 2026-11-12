ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plan_interval text,
  ADD COLUMN IF NOT EXISTS plan_status text,
  ADD COLUMN IF NOT EXISTS plan_period_start timestamptz,
  ADD COLUMN IF NOT EXISTS plan_active_until timestamptz,
  ADD COLUMN IF NOT EXISTS plan_subscription_id text,
  ADD COLUMN IF NOT EXISTS plan_cancel_at_period_end boolean NOT NULL DEFAULT false;

ALTER TABLE public.memberships ADD CONSTRAINT memberships_plan_check CHECK (plan IN ('free','plus','pro'));
ALTER TABLE public.memberships ADD CONSTRAINT memberships_plan_interval_check CHECK (plan_interval IS NULL OR plan_interval IN ('month','year'));

COMMENT ON COLUMN public.memberships.trial_ends_at IS 'DEPRECATED: the 3-day trial was replaced by the free tier and no longer grants access.';
COMMENT ON COLUMN public.memberships.monthly_active_until IS 'DEPRECATED: legacy single monthly plan, treated as Pro while active. Replaced by plan / plan_active_until.';

-- Resolve a member's plan: owner > pro > plus > founder > free.
CREATE OR REPLACE FUNCTION public.member_plan(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN _user_id IS NULL THEN 'free'
    WHEN _user_id <> auth.uid() AND auth.role() <> 'service_role' AND NOT public.is_owner() THEN 'free'
    WHEN public.has_role(_user_id, 'admin'::public.app_role) THEN 'owner'
    WHEN EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = _user_id AND m.plan = 'pro' AND m.plan_active_until > now()) THEN 'pro'
    WHEN EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = _user_id AND m.monthly_active_until > now()) THEN 'pro'
    WHEN EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = _user_id AND m.plan = 'plus' AND m.plan_active_until > now()) THEN 'plus'
    WHEN EXISTS (SELECT 1 FROM public.memberships m WHERE m.user_id = _user_id AND m.founder_number IS NOT NULL) THEN 'founder'
    ELSE 'free'
  END
$$;

CREATE OR REPLACE FUNCTION public.plan_rank(_plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE _plan WHEN 'owner' THEN 3 WHEN 'pro' THEN 2 WHEN 'plus' THEN 1 WHEN 'founder' THEN 1 ELSE 0 END
$$;

-- Which plan a paid service needs. Heavy video, build, telephony and vision tools are Pro; every other paid AI action is Plus.
CREATE OR REPLACE FUNCTION public.service_required_plan(_service text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN lower(coalesce(_service,'')) ~ '^(movie|runway|replicate|youtube|script-to-scenes|app-builder|oracle-coder|phone-call|ai-outbound-call|voice-receptionist|live-vision|elevenlabs-clone-voice|gemini-video|compile-marketing-video|video|lip|heygen|living)' THEN 'pro'
    ELSE 'plus'
  END
$$;

-- Paid members are anyone above the free tier.
CREATE OR REPLACE FUNCTION public.is_active_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT public.member_plan(_user_id) <> 'free'
$$;

-- Monthly plan credit ledger: one row per billing month, never granted twice.
CREATE TABLE public.plan_credit_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  grant_key text NOT NULL UNIQUE,
  plan text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  transaction_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_plan_credit_grants_user ON public.plan_credit_grants(user_id, created_at DESC);
GRANT SELECT ON public.plan_credit_grants TO authenticated;
GRANT ALL ON public.plan_credit_grants TO service_role;
ALTER TABLE public.plan_credit_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own plan credits" ON public.plan_credit_grants FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner reads all plan credits" ON public.plan_credit_grants FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.plan_credit_cents(_plan text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$
  SELECT CASE _plan WHEN 'plus' THEN 200 WHEN 'pro' THEN 650 ELSE 0 END
$$;

CREATE OR REPLACE FUNCTION public.grant_plan_credit(_user_id uuid, _grant_key text, _plan text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cents integer := public.plan_credit_cents(_plan);
  v_grant uuid;
  v_tx uuid;
  v_micros bigint;
BEGIN
  IF _user_id IS NULL OR NULLIF(btrim(_grant_key),'') IS NULL OR v_cents <= 0 THEN RETURN false; END IF;
  INSERT INTO public.plan_credit_grants(user_id, grant_key, plan, amount_cents)
  VALUES (_user_id, _grant_key, _plan, v_cents)
  ON CONFLICT (grant_key) DO NOTHING
  RETURNING id INTO v_grant;
  IF v_grant IS NULL THEN RETURN false; END IF;
  v_micros := v_cents::bigint * 10000;
  INSERT INTO public.wallet_balances(user_id, balance_cents) VALUES (_user_id, 0) ON CONFLICT (user_id) DO NOTHING;
  PERFORM 1 FROM public.wallet_balances WHERE user_id = _user_id FOR UPDATE;
  INSERT INTO public.billing_transactions(user_id, request_key, transaction_type, status, total_micros, currency, metadata, settled_at)
  VALUES (_user_id, 'plan-credit:' || _grant_key, 'adjustment', 'settled', v_micros, 'USD',
          jsonb_build_object('kind','plan_credit','plan',_plan,'grant_key',_grant_key), now())
  RETURNING id INTO v_tx;
  UPDATE public.wallet_balances SET balance_cents = balance_cents + v_cents, updated_at = now() WHERE user_id = _user_id;
  INSERT INTO public.billing_ledger_entries(transaction_id, user_id, account_type, amount_micros) VALUES
    (v_tx, _user_id, 'user_wallet', v_micros), (v_tx, _user_id, 'promotional_funding', -v_micros);
  UPDATE public.plan_credit_grants SET transaction_id = v_tx WHERE id = v_grant;
  RETURN true;
END;
$$;

-- Grants this billing month's credit to every active paid plan. Monthly plans get one per renewal; yearly plans one per month of the year.
CREATE OR REPLACE FUNCTION public.grant_due_plan_credits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
  v_n integer;
  v_count integer := 0;
BEGIN
  FOR r IN
    SELECT m.user_id, m.plan, m.plan_interval, m.plan_period_start, m.plan_subscription_id
    FROM public.memberships m
    WHERE m.plan IN ('plus','pro') AND m.plan_status = 'active'
      AND m.plan_active_until > now() AND m.plan_period_start IS NOT NULL
      AND m.plan_period_start <= now() AND m.plan_subscription_id IS NOT NULL
  LOOP
    v_n := (extract(year FROM age(now(), r.plan_period_start)) * 12 + extract(month FROM age(now(), r.plan_period_start)))::integer;
    IF coalesce(r.plan_interval,'month') = 'month' THEN v_n := 0; ELSE v_n := LEAST(GREATEST(v_n,0), 11); END IF;
    IF public.grant_plan_credit(r.user_id, r.plan_subscription_id || ':' || extract(epoch FROM r.plan_period_start)::bigint || ':' || v_n, r.plan) THEN
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.grant_plan_credit(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.grant_due_plan_credits() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.grant_plan_credit(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.grant_due_plan_credits() TO service_role;
GRANT EXECUTE ON FUNCTION public.member_plan(uuid) TO authenticated, service_role;

-- Server-side plan check on every paid AI action.
CREATE OR REPLACE FUNCTION public.billing_authorize(_user_id uuid, _request_key text, _service text, _provider text, _model text, _estimated_provider_cost_micros bigint, _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(transaction_id uuid, hold_id uuid, held_total_micros bigint, available_balance_micros bigint, duplicate boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wallet_cents integer;
  v_existing public.billing_transactions%ROWTYPE;
  v_provider bigint := GREATEST(0, COALESCE(_estimated_provider_cost_micros,0));
  v_fee bigint := CEIL(v_provider * 0.20)::bigint;
  v_total bigint;
  v_open bigint;
  v_available bigint;
  v_daily bigint;
  v_monthly bigint;
  v_budget public.billing_budgets%ROWTYPE;
  v_tx uuid;
  v_hold uuid;
  v_need text;
BEGIN
  IF _user_id IS NULL OR NULLIF(btrim(_request_key),'') IS NULL OR NULLIF(btrim(_service),'') IS NULL THEN
    RAISE EXCEPTION 'invalid billing authorization';
  END IF;
  v_total := GREATEST(10000, v_provider + v_fee);
  SELECT * INTO v_existing FROM public.billing_transactions t WHERE t.user_id=_user_id AND t.request_key=_request_key;
  IF FOUND THEN
    SELECT h.id INTO v_hold FROM public.billing_holds h WHERE h.transaction_id=v_existing.id;
    RETURN QUERY SELECT v_existing.id, v_hold, v_existing.total_micros,
      COALESCE((SELECT wb.balance_cents::bigint * 10000 FROM public.wallet_balances wb WHERE wb.user_id=_user_id),0), true;
    RETURN;
  END IF;
  v_need := public.service_required_plan(_service);
  IF public.plan_rank(public.member_plan(_user_id)) < public.plan_rank(v_need) THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='plan_required:' || v_need;
  END IF;
  INSERT INTO public.wallet_balances(user_id,balance_cents) VALUES(_user_id,0) ON CONFLICT(user_id) DO NOTHING;
  SELECT wb.balance_cents INTO v_wallet_cents FROM public.wallet_balances wb WHERE wb.user_id=_user_id FOR UPDATE;
  SELECT COALESCE(SUM(h.held_total_micros),0) INTO v_open FROM public.billing_holds h
    WHERE h.user_id=_user_id AND h.status='held' AND h.expires_at > now();
  v_available := v_wallet_cents::bigint * 10000 - v_open;
  INSERT INTO public.billing_budgets(user_id) VALUES(_user_id) ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO v_budget FROM public.billing_budgets b WHERE b.user_id=_user_id;
  SELECT COALESCE(SUM(t.total_micros),0) INTO v_daily FROM public.billing_transactions t
    WHERE t.user_id=_user_id AND t.transaction_type='usage' AND t.status='settled' AND t.created_at >= date_trunc('day',now());
  SELECT COALESCE(SUM(t.total_micros),0) INTO v_monthly FROM public.billing_transactions t
    WHERE t.user_id=_user_id AND t.transaction_type='usage' AND t.status='settled' AND t.created_at >= date_trunc('month',now());
  IF v_available < v_total THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='insufficient_funds'; END IF;
  IF v_budget.hard_stop AND (v_daily + v_total > v_budget.daily_limit_cents::bigint*10000 OR v_monthly + v_total > v_budget.monthly_limit_cents::bigint*10000) THEN
    RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='budget_exceeded';
  END IF;
  INSERT INTO public.billing_transactions(user_id,request_key,transaction_type,status,service,provider,model,provider_cost_micros,platform_fee_micros,total_micros,metadata)
  VALUES(_user_id,_request_key,'usage','held',_service,_provider,_model,v_provider,v_fee,v_total,COALESCE(_metadata,'{}'::jsonb)) RETURNING id INTO v_tx;
  INSERT INTO public.billing_holds(transaction_id,user_id,service,provider,model,estimated_provider_cost_micros,estimated_fee_micros,held_total_micros)
  VALUES(v_tx,_user_id,_service,_provider,_model,v_provider,v_fee,v_total) RETURNING id INTO v_hold;
  RETURN QUERY SELECT v_tx,v_hold,v_total,v_available-v_total,false;
END;
$function$;

SELECT cron.schedule('plan-credit-monthly-grants', '17 * * * *', 'SELECT public.grant_due_plan_credits();');