
-- Role-based unlimited AI check (no hardcoded email at the bypass layer).
CREATE OR REPLACE FUNCTION public.has_unlimited_ai(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.reward_grants
      WHERE user_id = _user_id
        AND active = true
        AND expires_at > now()
        AND reward_type IN ('free_for_life','unlimited_ai')
    );
$$;

-- Update wallet_charge_ai to use the role/grant-based bypass.
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
AS $$
DECLARE
  v_total INTEGER := GREATEST(1, COALESCE(_provider_cost_cents,0) + COALESCE(_platform_fee_cents,0));
  v_balance INTEGER;
  v_charge_id UUID;
  v_unlimited BOOLEAN;
  v_meta jsonb;
BEGIN
  v_unlimited := public.has_unlimited_ai(_user_id);

  INSERT INTO public.wallet_balances (user_id, balance_cents)
  VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance_cents INTO v_balance
  FROM public.wallet_balances WHERE user_id = _user_id FOR UPDATE;

  IF NOT v_unlimited AND v_balance < v_total THEN
    RETURN QUERY SELECT NULL::UUID, v_total, v_balance, TRUE;
    RETURN;
  END IF;

  IF NOT v_unlimited THEN
    UPDATE public.wallet_balances
      SET balance_cents = balance_cents - v_total, updated_at = now()
      WHERE user_id = _user_id
      RETURNING balance_cents INTO v_balance;
  END IF;

  v_meta := COALESCE(_metadata,'{}'::jsonb)
    || jsonb_build_object('unlimited_bypass', v_unlimited);

  INSERT INTO public.ai_charges (user_id, service, provider_cost_cents, platform_fee_cents, total_cents, metadata)
  VALUES (
    _user_id,
    _service,
    COALESCE(_provider_cost_cents,0),
    COALESCE(_platform_fee_cents,0),
    CASE WHEN v_unlimited THEN 0 ELSE v_total END,
    v_meta
  )
  RETURNING id INTO v_charge_id;

  RETURN QUERY SELECT v_charge_id, CASE WHEN v_unlimited THEN 0 ELSE v_total END, v_balance, FALSE;
END;
$$;
