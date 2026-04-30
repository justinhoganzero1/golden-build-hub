-- Audit log for every AI coin charge
CREATE TABLE IF NOT EXISTS public.ai_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  service TEXT NOT NULL,
  provider_cost_cents INTEGER NOT NULL DEFAULT 0,
  platform_fee_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own ai charges"
  ON public.ai_charges FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_ai_charges_user_created
  ON public.ai_charges (user_id, created_at DESC);

-- Generic wallet charge for AI calls.
-- Deducts (provider_cost_cents + platform_fee_cents) from wallet_balances.
-- Returns insufficient=true and does NOT deduct when balance is too low.
CREATE OR REPLACE FUNCTION public.wallet_charge_ai(
  _user_id UUID,
  _service TEXT,
  _provider_cost_cents INTEGER,
  _platform_fee_cents INTEGER,
  _metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE(charge_id UUID, total_billed_cents INTEGER, new_balance_cents INTEGER, insufficient BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER := GREATEST(1, COALESCE(_provider_cost_cents,0) + COALESCE(_platform_fee_cents,0));
  v_balance INTEGER;
  v_charge_id UUID;
  v_is_admin BOOLEAN;
BEGIN
  -- Admin bypass: log the charge but do not deduct
  v_is_admin := public.has_role(_user_id, 'admin');

  INSERT INTO public.wallet_balances (user_id, balance_cents)
  VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance_cents INTO v_balance
  FROM public.wallet_balances WHERE user_id = _user_id FOR UPDATE;

  IF NOT v_is_admin AND v_balance < v_total THEN
    RETURN QUERY SELECT NULL::UUID, v_total, v_balance, TRUE;
    RETURN;
  END IF;

  IF NOT v_is_admin THEN
    UPDATE public.wallet_balances
      SET balance_cents = balance_cents - v_total, updated_at = now()
      WHERE user_id = _user_id
      RETURNING balance_cents INTO v_balance;
  END IF;

  INSERT INTO public.ai_charges (user_id, service, provider_cost_cents, platform_fee_cents, total_cents, metadata)
  VALUES (_user_id, _service, COALESCE(_provider_cost_cents,0), COALESCE(_platform_fee_cents,0), v_total, COALESCE(_metadata,'{}'::jsonb))
  RETURNING id INTO v_charge_id;

  RETURN QUERY SELECT v_charge_id, v_total, v_balance, FALSE;
END;
$$;