
-- Wallet balances (prepaid AUD for Oracle Assisted Calling)
CREATE TABLE IF NOT EXISTS public.wallet_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  balance_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'AUD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wallet_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own wallet"
  ON public.wallet_balances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own wallet"
  ON public.wallet_balances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_wallet_balances_updated_at
  BEFORE UPDATE ON public.wallet_balances
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Call charges ledger (Twilio cost + 50% markup)
CREATE TABLE IF NOT EXISTS public.call_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  destination TEXT NOT NULL,
  twilio_call_sid TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  twilio_cost_cents INTEGER NOT NULL DEFAULT 0,
  service_fee_cents INTEGER NOT NULL DEFAULT 0,
  total_billed_cents INTEGER NOT NULL DEFAULT 0,
  rate_per_minute_cents INTEGER NOT NULL DEFAULT 45,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.call_charges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own charges"
  ON public.call_charges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Owner views all charges"
  ON public.call_charges FOR SELECT
  TO authenticated
  USING (is_owner());

CREATE INDEX idx_call_charges_user ON public.call_charges(user_id, created_at DESC);

CREATE TRIGGER update_call_charges_updated_at
  BEFORE UPDATE ON public.call_charges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atomic charge function: deducts from wallet, records ledger entry
CREATE OR REPLACE FUNCTION public.wallet_charge_call(
  _user_id UUID,
  _destination TEXT,
  _twilio_call_sid TEXT,
  _duration_seconds INTEGER,
  _twilio_cost_cents INTEGER
)
RETURNS TABLE (
  charge_id UUID,
  total_billed_cents INTEGER,
  new_balance_cents INTEGER,
  insufficient BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_service_fee INTEGER := CEIL(_twilio_cost_cents * 0.5);
  v_total INTEGER := _twilio_cost_cents + v_service_fee;
  v_balance INTEGER;
  v_charge_id UUID;
  v_insufficient BOOLEAN := false;
BEGIN
  -- Ensure wallet row exists
  INSERT INTO public.wallet_balances (user_id, balance_cents)
  VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance_cents INTO v_balance
  FROM public.wallet_balances WHERE user_id = _user_id FOR UPDATE;

  IF v_balance < v_total THEN
    v_insufficient := true;
  END IF;

  UPDATE public.wallet_balances
  SET balance_cents = balance_cents - v_total, updated_at = now()
  WHERE user_id = _user_id
  RETURNING balance_cents INTO v_balance;

  INSERT INTO public.call_charges (
    user_id, destination, twilio_call_sid, duration_seconds,
    twilio_cost_cents, service_fee_cents, total_billed_cents, status
  ) VALUES (
    _user_id, _destination, _twilio_call_sid, _duration_seconds,
    _twilio_cost_cents, v_service_fee, v_total,
    CASE WHEN v_insufficient THEN 'completed_overdraft' ELSE 'completed' END
  ) RETURNING id INTO v_charge_id;

  RETURN QUERY SELECT v_charge_id, v_total, v_balance, v_insufficient;
END;
$$;

-- Top-up function (called after successful Stripe payment)
CREATE OR REPLACE FUNCTION public.wallet_topup(
  _user_id UUID,
  _amount_cents INTEGER
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  INSERT INTO public.wallet_balances (user_id, balance_cents)
  VALUES (_user_id, _amount_cents)
  ON CONFLICT (user_id) DO UPDATE
    SET balance_cents = public.wallet_balances.balance_cents + _amount_cents,
        updated_at = now()
  RETURNING balance_cents INTO v_new_balance;
  RETURN v_new_balance;
END;
$$;
