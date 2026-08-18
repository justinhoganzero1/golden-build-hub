CREATE TABLE public.billing_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_key text NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('usage','topup','refund','adjustment','chargeback','opening_balance')),
  status text NOT NULL CHECK (status IN ('pending','held','settled','cancelled','refunded','failed','disputed')),
  service text,
  provider text,
  model text,
  provider_request_id text,
  provider_cost_micros bigint NOT NULL DEFAULT 0 CHECK (provider_cost_micros >= 0),
  platform_fee_micros bigint NOT NULL DEFAULT 0 CHECK (platform_fee_micros >= 0),
  total_micros bigint NOT NULL DEFAULT 0 CHECK (total_micros >= 0),
  currency text NOT NULL DEFAULT 'USD',
  stripe_event_id text,
  stripe_session_id text,
  stripe_payment_intent text,
  original_transaction_id uuid REFERENCES public.billing_transactions(id),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz,
  UNIQUE (user_id, request_key)
);
GRANT SELECT ON public.billing_transactions TO authenticated;
GRANT ALL ON public.billing_transactions TO service_role;
ALTER TABLE public.billing_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own billing transactions" ON public.billing_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_owner());

CREATE UNIQUE INDEX billing_transactions_stripe_event_unique ON public.billing_transactions(stripe_event_id) WHERE stripe_event_id IS NOT NULL;
CREATE UNIQUE INDEX billing_transactions_stripe_session_unique ON public.billing_transactions(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE UNIQUE INDEX billing_transactions_stripe_intent_unique ON public.billing_transactions(stripe_payment_intent) WHERE stripe_payment_intent IS NOT NULL AND transaction_type = 'topup';
CREATE INDEX billing_transactions_user_created_idx ON public.billing_transactions(user_id, created_at DESC);
CREATE INDEX billing_transactions_status_idx ON public.billing_transactions(status, created_at);

CREATE TABLE public.billing_ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.billing_transactions(id),
  user_id uuid NOT NULL,
  account_type text NOT NULL CHECK (account_type IN ('user_wallet','provider_payable','platform_revenue','stripe_clearing','promotional_funding','chargeback_reserve')),
  amount_micros bigint NOT NULL CHECK (amount_micros <> 0),
  currency text NOT NULL DEFAULT 'USD',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.billing_ledger_entries TO authenticated;
GRANT ALL ON public.billing_ledger_entries TO service_role;
ALTER TABLE public.billing_ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own billing ledger" ON public.billing_ledger_entries FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_owner());
CREATE INDEX billing_ledger_transaction_idx ON public.billing_ledger_entries(transaction_id);
CREATE INDEX billing_ledger_user_created_idx ON public.billing_ledger_entries(user_id, created_at DESC);

CREATE TABLE public.billing_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL UNIQUE REFERENCES public.billing_transactions(id),
  user_id uuid NOT NULL,
  service text NOT NULL,
  provider text,
  model text,
  estimated_provider_cost_micros bigint NOT NULL CHECK (estimated_provider_cost_micros >= 0),
  estimated_fee_micros bigint NOT NULL CHECK (estimated_fee_micros >= 0),
  held_total_micros bigint NOT NULL CHECK (held_total_micros > 0),
  status text NOT NULL DEFAULT 'held' CHECK (status IN ('held','settled','cancelled','expired')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz
);
GRANT SELECT ON public.billing_holds TO authenticated;
GRANT ALL ON public.billing_holds TO service_role;
ALTER TABLE public.billing_holds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own billing holds" ON public.billing_holds FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_owner());
CREATE INDEX billing_holds_available_idx ON public.billing_holds(user_id, status, expires_at);

CREATE TABLE public.usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.billing_transactions(id),
  user_id uuid NOT NULL,
  service text NOT NULL,
  provider text,
  model text,
  unit_type text NOT NULL CHECK (unit_type IN ('input_token','output_token','character','image','audio_second','video_second','call_minute','sms_segment','compute_second','storage_gb','bandwidth_gb','request')),
  quantity numeric(20,6) NOT NULL CHECK (quantity >= 0),
  unit_cost_micros numeric(20,6) NOT NULL DEFAULT 0 CHECK (unit_cost_micros >= 0),
  provider_cost_micros bigint NOT NULL DEFAULT 0 CHECK (provider_cost_micros >= 0),
  provider_request_id text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.usage_events TO authenticated;
GRANT ALL ON public.usage_events TO service_role;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own usage events" ON public.usage_events FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_owner());
CREATE INDEX usage_events_user_created_idx ON public.usage_events(user_id, created_at DESC);
CREATE INDEX usage_events_transaction_idx ON public.usage_events(transaction_id);

CREATE TABLE public.billing_budgets (
  user_id uuid PRIMARY KEY,
  daily_limit_cents integer NOT NULL DEFAULT 5000 CHECK (daily_limit_cents >= 0),
  monthly_limit_cents integer NOT NULL DEFAULT 50000 CHECK (monthly_limit_cents >= 0),
  hard_stop boolean NOT NULL DEFAULT true,
  low_balance_alert_cents integer NOT NULL DEFAULT 500 CHECK (low_balance_alert_cents >= 0),
  auto_topup_enabled boolean NOT NULL DEFAULT false,
  auto_topup_threshold_cents integer NOT NULL DEFAULT 500 CHECK (auto_topup_threshold_cents >= 0),
  auto_topup_pack_cents integer NOT NULL DEFAULT 2000 CHECK (auto_topup_pack_cents IN (500,1000,2000,5000,10000)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.billing_budgets TO authenticated;
GRANT ALL ON public.billing_budgets TO service_role;
ALTER TABLE public.billing_budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own billing budget" ON public.billing_budgets FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_owner());
CREATE POLICY "Users create own billing budget" ON public.billing_budgets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own billing budget" ON public.billing_budgets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER billing_budgets_updated_at BEFORE UPDATE ON public.billing_budgets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.prevent_billing_ledger_mutation()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RAISE EXCEPTION 'Billing ledger entries are immutable; post a compensating transaction instead';
END;
$$;
REVOKE ALL ON FUNCTION public.prevent_billing_ledger_mutation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prevent_billing_ledger_mutation() TO service_role;
CREATE TRIGGER billing_ledger_immutable BEFORE UPDATE OR DELETE ON public.billing_ledger_entries FOR EACH ROW EXECUTE FUNCTION public.prevent_billing_ledger_mutation();

CREATE OR REPLACE FUNCTION public.billing_authorize(
  _user_id uuid,
  _request_key text,
  _service text,
  _provider text,
  _model text,
  _estimated_provider_cost_micros bigint,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(transaction_id uuid, hold_id uuid, held_total_micros bigint, available_balance_micros bigint, duplicate boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_wallet_cents integer;
  v_existing public.billing_transactions%ROWTYPE;
  v_provider bigint := GREATEST(0, COALESCE(_estimated_provider_cost_micros,0));
  v_fee bigint := CEIL(v_provider * 0.10)::bigint;
  v_total bigint;
  v_open bigint;
  v_available bigint;
  v_daily bigint;
  v_monthly bigint;
  v_budget public.billing_budgets%ROWTYPE;
  v_tx uuid;
  v_hold uuid;
BEGIN
  IF _user_id IS NULL OR NULLIF(btrim(_request_key),'') IS NULL OR NULLIF(btrim(_service),'') IS NULL THEN
    RAISE EXCEPTION 'invalid billing authorization';
  END IF;
  v_total := GREATEST(10000, v_provider + v_fee);
  SELECT * INTO v_existing FROM public.billing_transactions WHERE user_id=_user_id AND request_key=_request_key;
  IF FOUND THEN
    SELECT h.id INTO v_hold FROM public.billing_holds h WHERE h.transaction_id=v_existing.id;
    RETURN QUERY SELECT v_existing.id, v_hold, v_existing.total_micros,
      COALESCE((SELECT balance_cents::bigint * 10000 FROM public.wallet_balances WHERE user_id=_user_id),0), true;
    RETURN;
  END IF;
  INSERT INTO public.wallet_balances(user_id,balance_cents) VALUES(_user_id,0) ON CONFLICT(user_id) DO NOTHING;
  SELECT balance_cents INTO v_wallet_cents FROM public.wallet_balances WHERE user_id=_user_id FOR UPDATE;
  SELECT COALESCE(SUM(held_total_micros),0) INTO v_open FROM public.billing_holds
    WHERE user_id=_user_id AND status='held' AND expires_at > now();
  v_available := v_wallet_cents::bigint * 10000 - v_open;
  INSERT INTO public.billing_budgets(user_id) VALUES(_user_id) ON CONFLICT(user_id) DO NOTHING;
  SELECT * INTO v_budget FROM public.billing_budgets WHERE user_id=_user_id;
  SELECT COALESCE(SUM(total_micros),0) INTO v_daily FROM public.billing_transactions
    WHERE user_id=_user_id AND transaction_type='usage' AND status='settled' AND created_at >= date_trunc('day',now());
  SELECT COALESCE(SUM(total_micros),0) INTO v_monthly FROM public.billing_transactions
    WHERE user_id=_user_id AND transaction_type='usage' AND status='settled' AND created_at >= date_trunc('month',now());
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
$$;
REVOKE ALL ON FUNCTION public.billing_authorize(uuid,text,text,text,text,bigint,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_authorize(uuid,text,text,text,text,bigint,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.billing_settle(
  _transaction_id uuid,
  _actual_provider_cost_micros bigint,
  _provider_request_id text DEFAULT NULL,
  _usage jsonb DEFAULT '[]'::jsonb,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(total_billed_cents integer, new_balance_cents integer, platform_fee_micros bigint)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_tx public.billing_transactions%ROWTYPE;
  v_hold public.billing_holds%ROWTYPE;
  v_provider bigint := GREATEST(0,COALESCE(_actual_provider_cost_micros,0));
  v_fee bigint := CEIL(v_provider*0.10)::bigint;
  v_total bigint;
  v_total_cents integer;
  v_balance integer;
  v_item jsonb;
BEGIN
  SELECT * INTO v_tx FROM public.billing_transactions WHERE id=_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'billing transaction not found'; END IF;
  IF v_tx.status='settled' THEN
    SELECT balance_cents INTO v_balance FROM public.wallet_balances WHERE user_id=v_tx.user_id;
    RETURN QUERY SELECT CEIL(v_tx.total_micros/10000.0)::integer,v_balance,v_tx.platform_fee_micros;
    RETURN;
  END IF;
  IF v_tx.status <> 'held' THEN RAISE EXCEPTION 'billing transaction is not settleable'; END IF;
  SELECT * INTO v_hold FROM public.billing_holds WHERE transaction_id=_transaction_id FOR UPDATE;
  SELECT balance_cents INTO v_balance FROM public.wallet_balances WHERE user_id=v_tx.user_id FOR UPDATE;
  v_total := v_provider+v_fee;
  v_total_cents := CEIL(v_total/10000.0)::integer;
  IF v_balance < v_total_cents THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='insufficient_funds_at_settlement'; END IF;
  UPDATE public.wallet_balances SET balance_cents=balance_cents-v_total_cents,updated_at=now() WHERE user_id=v_tx.user_id RETURNING balance_cents INTO v_balance;
  UPDATE public.billing_transactions SET status='settled',provider_cost_micros=v_provider,platform_fee_micros=v_fee,total_micros=v_total,provider_request_id=_provider_request_id,metadata=metadata||COALESCE(_metadata,'{}'::jsonb),settled_at=now() WHERE id=_transaction_id;
  UPDATE public.billing_holds SET status='settled',released_at=now() WHERE transaction_id=_transaction_id;
  INSERT INTO public.billing_ledger_entries(transaction_id,user_id,account_type,amount_micros) VALUES
    (_transaction_id,v_tx.user_id,'user_wallet',-v_total),
    (_transaction_id,v_tx.user_id,'provider_payable',v_provider),
    (_transaction_id,v_tx.user_id,'platform_revenue',v_fee);
  INSERT INTO public.ai_charges(user_id,service,provider_cost_cents,platform_fee_cents,total_cents,metadata)
  VALUES(v_tx.user_id,v_tx.service,CEIL(v_provider/10000.0)::integer,CEIL(v_fee/10000.0)::integer,v_total_cents,
    v_tx.metadata||jsonb_build_object('billing_transaction_id',_transaction_id,'request_key',v_tx.request_key,'provider',v_tx.provider,'model',v_tx.model,'actual_cost',true,'margin_pct',10));
  IF jsonb_typeof(_usage)='array' THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(_usage) LOOP
      INSERT INTO public.usage_events(transaction_id,user_id,service,provider,model,unit_type,quantity,unit_cost_micros,provider_cost_micros,provider_request_id,metadata)
      VALUES(_transaction_id,v_tx.user_id,v_tx.service,v_tx.provider,v_tx.model,
        COALESCE(v_item->>'unit_type','request'),COALESCE((v_item->>'quantity')::numeric,0),COALESCE((v_item->>'unit_cost_micros')::numeric,0),COALESCE((v_item->>'provider_cost_micros')::bigint,0),_provider_request_id,COALESCE(v_item->'metadata','{}'::jsonb));
    END LOOP;
  END IF;
  RETURN QUERY SELECT v_total_cents,v_balance,v_fee;
END;
$$;
REVOKE ALL ON FUNCTION public.billing_settle(uuid,bigint,text,jsonb,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_settle(uuid,bigint,text,jsonb,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.billing_cancel(_transaction_id uuid,_reason text DEFAULT 'provider_failed')
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.billing_transactions WHERE id=_transaction_id FOR UPDATE;
  IF v_status='cancelled' THEN RETURN true; END IF;
  IF v_status <> 'held' THEN RETURN false; END IF;
  UPDATE public.billing_transactions SET status='cancelled',metadata=metadata||jsonb_build_object('cancel_reason',_reason),settled_at=now() WHERE id=_transaction_id;
  UPDATE public.billing_holds SET status='cancelled',released_at=now() WHERE transaction_id=_transaction_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.billing_cancel(uuid,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_cancel(uuid,text) TO service_role;

CREATE OR REPLACE FUNCTION public.billing_refund(_transaction_id uuid,_refund_micros bigint,_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_original public.billing_transactions%ROWTYPE; v_refund bigint; v_cents integer; v_id uuid;
BEGIN
  SELECT * INTO v_original FROM public.billing_transactions WHERE id=_transaction_id FOR UPDATE;
  IF NOT FOUND OR v_original.status NOT IN ('settled','disputed') THEN RAISE EXCEPTION 'transaction is not refundable'; END IF;
  v_refund:=LEAST(GREATEST(_refund_micros,0),v_original.total_micros);
  IF v_refund=0 THEN RAISE EXCEPTION 'refund must be positive'; END IF;
  INSERT INTO public.billing_transactions(user_id,request_key,transaction_type,status,service,provider,model,total_micros,original_transaction_id,metadata,settled_at)
  VALUES(v_original.user_id,'refund:'||_transaction_id::text||':'||v_refund::text,'refund','settled',v_original.service,v_original.provider,v_original.model,v_refund,_transaction_id,jsonb_build_object('reason',_reason),now()) RETURNING id INTO v_id;
  v_cents:=FLOOR(v_refund/10000.0)::integer;
  UPDATE public.wallet_balances SET balance_cents=balance_cents+v_cents,updated_at=now() WHERE user_id=v_original.user_id;
  INSERT INTO public.billing_ledger_entries(transaction_id,user_id,account_type,amount_micros) VALUES
    (v_id,v_original.user_id,'user_wallet',v_refund),(v_id,v_original.user_id,'provider_payable',-LEAST(v_refund,v_original.provider_cost_micros));
  IF v_refund>v_original.provider_cost_micros THEN
    INSERT INTO public.billing_ledger_entries(transaction_id,user_id,account_type,amount_micros) VALUES(v_id,v_original.user_id,'platform_revenue',-(v_refund-v_original.provider_cost_micros));
  END IF;
  UPDATE public.billing_transactions SET status='refunded' WHERE id=_transaction_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.billing_refund(uuid,bigint,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_refund(uuid,bigint,text) TO service_role;

CREATE UNIQUE INDEX wallet_topups_session_unique ON public.wallet_topups(stripe_session_id) WHERE stripe_session_id IS NOT NULL;
CREATE UNIQUE INDEX wallet_topups_intent_unique ON public.wallet_topups(stripe_payment_intent) WHERE stripe_payment_intent IS NOT NULL;

CREATE OR REPLACE FUNCTION public.billing_credit_stripe_topup(
  _user_id uuid,
  _stripe_event_id text,
  _stripe_session_id text,
  _stripe_payment_intent text,
  _wallet_cents integer,
  _gross_cents integer,
  _currency text,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS TABLE(transaction_id uuid,new_balance_cents integer,duplicate boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_id uuid; v_balance integer; v_existing uuid; v_micros bigint;
BEGIN
  IF _user_id IS NULL OR NULLIF(_stripe_event_id,'') IS NULL OR NULLIF(_stripe_session_id,'') IS NULL OR _wallet_cents<=0 OR _gross_cents<=0 OR lower(_currency)<>'usd' THEN RAISE EXCEPTION 'invalid topup'; END IF;
  SELECT id INTO v_existing FROM public.billing_transactions WHERE stripe_event_id=_stripe_event_id OR stripe_session_id=_stripe_session_id OR (_stripe_payment_intent IS NOT NULL AND stripe_payment_intent=_stripe_payment_intent) LIMIT 1;
  IF v_existing IS NOT NULL THEN
    SELECT balance_cents INTO v_balance FROM public.wallet_balances WHERE user_id=_user_id;
    RETURN QUERY SELECT v_existing,COALESCE(v_balance,0),true; RETURN;
  END IF;
  INSERT INTO public.wallet_balances(user_id,balance_cents) VALUES(_user_id,0) ON CONFLICT(user_id) DO NOTHING;
  SELECT balance_cents INTO v_balance FROM public.wallet_balances WHERE user_id=_user_id FOR UPDATE;
  INSERT INTO public.wallet_topups(user_id,amount_cents,gross_cents,fee_cents,source,stripe_session_id,stripe_payment_intent,metadata)
  VALUES(_user_id,_wallet_cents,_gross_cents,GREATEST(0,_gross_cents-_wallet_cents),'stripe',_stripe_session_id,_stripe_payment_intent,COALESCE(_metadata,'{}'::jsonb)||jsonb_build_object('stripe_event_id',_stripe_event_id));
  v_micros:=_wallet_cents::bigint*10000;
  INSERT INTO public.billing_transactions(user_id,request_key,transaction_type,status,total_micros,currency,stripe_event_id,stripe_session_id,stripe_payment_intent,metadata,settled_at)
  VALUES(_user_id,'stripe:'||_stripe_event_id,'topup','settled',v_micros,upper(_currency),_stripe_event_id,_stripe_session_id,_stripe_payment_intent,COALESCE(_metadata,'{}'::jsonb),now()) RETURNING id INTO v_id;
  UPDATE public.wallet_balances SET balance_cents=balance_cents+_wallet_cents,updated_at=now() WHERE user_id=_user_id RETURNING balance_cents INTO v_balance;
  INSERT INTO public.billing_ledger_entries(transaction_id,user_id,account_type,amount_micros) VALUES
    (v_id,_user_id,'user_wallet',v_micros),(v_id,_user_id,'stripe_clearing',-v_micros);
  RETURN QUERY SELECT v_id,v_balance,false;
END;
$$;
REVOKE ALL ON FUNCTION public.billing_credit_stripe_topup(uuid,text,text,text,integer,integer,text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_credit_stripe_topup(uuid,text,text,text,integer,integer,text,jsonb) TO service_role;

INSERT INTO public.billing_transactions(user_id,request_key,transaction_type,status,total_micros,currency,metadata,settled_at)
SELECT w.user_id,'opening-balance-v2','opening_balance','settled',w.balance_cents::bigint*10000,COALESCE(w.currency,'AUD'),jsonb_build_object('source','wallet_balances_cutover'),now()
FROM public.wallet_balances w ON CONFLICT(user_id,request_key) DO NOTHING;
INSERT INTO public.billing_ledger_entries(transaction_id,user_id,account_type,amount_micros,currency,metadata)
SELECT t.id,t.user_id,'user_wallet',t.total_micros,t.currency,jsonb_build_object('source','wallet_balances_cutover')
FROM public.billing_transactions t WHERE t.request_key='opening-balance-v2' AND t.total_micros<>0
AND NOT EXISTS(SELECT 1 FROM public.billing_ledger_entries e WHERE e.transaction_id=t.id);

REVOKE ALL ON FUNCTION public.wallet_topup(uuid,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_topup_logged(uuid,integer,integer,integer,text,text,text,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_charge_ai(uuid,text,integer,integer,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.wallet_charge_call(uuid,text,text,integer,integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_topup(uuid,integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_topup_logged(uuid,integer,integer,integer,text,text,text,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_charge_ai(uuid,text,integer,integer,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.wallet_charge_call(uuid,text,text,integer,integer) TO service_role;