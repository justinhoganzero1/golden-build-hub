-- Detect whether a user account is an anonymous Supabase visitor
CREATE OR REPLACE FUNCTION public.is_anon_visitor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (SELECT is_anonymous FROM auth.users WHERE id = _user_id),
    false
  );
$$;

-- Replace wallet_charge_ai to apply 3× multiplier on anonymous visitors
CREATE OR REPLACE FUNCTION public.wallet_charge_ai(
  _user_id uuid,
  _service text,
  _provider_cost_cents integer,
  _platform_fee_cents integer,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE(charge_id uuid, total_billed_cents integer, new_balance_cents integer, insufficient boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_base integer := GREATEST(1, COALESCE(_provider_cost_cents,0) + COALESCE(_platform_fee_cents,0));
  v_anon boolean;
  v_multiplier integer;
  v_total integer;
  v_balance integer;
  v_charge_id uuid;
  v_unlimited boolean;
  v_meta jsonb;
  v_min_balance integer;
  v_daily_cap integer;
  v_today_spent integer;
BEGIN
  v_unlimited := public.has_unlimited_ai(_user_id);
  v_anon := public.is_anon_visitor(_user_id);
  v_multiplier := CASE WHEN v_anon THEN 3 ELSE 1 END;
  v_total := v_base * v_multiplier;

  INSERT INTO public.wallet_balances (user_id, balance_cents) VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT min_balance_cents, daily_spend_cap_cents INTO v_min_balance, v_daily_cap
  FROM public.wallet_limits WHERE user_id = _user_id;
  v_min_balance := COALESCE(v_min_balance, 0);
  v_daily_cap := COALESCE(v_daily_cap, 5000);

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

  v_meta := COALESCE(_metadata,'{}'::jsonb)
    || jsonb_build_object('unlimited_bypass', v_unlimited, 'anon_visitor', v_anon, 'price_multiplier', v_multiplier);

  INSERT INTO public.ai_charges (user_id, service, provider_cost_cents, platform_fee_cents, total_cents, metadata)
  VALUES (_user_id, _service, COALESCE(_provider_cost_cents,0), COALESCE(_platform_fee_cents,0) * v_multiplier,
          CASE WHEN v_unlimited THEN 0 ELSE v_total END, v_meta)
  RETURNING id INTO v_charge_id;

  RETURN QUERY SELECT v_charge_id, CASE WHEN v_unlimited THEN 0 ELSE v_total END, v_balance, FALSE;
END;
$function$;