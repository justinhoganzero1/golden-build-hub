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
  SELECT * INTO v_existing FROM public.billing_transactions t WHERE t.user_id=_user_id AND t.request_key=_request_key;
  IF FOUND THEN
    SELECT h.id INTO v_hold FROM public.billing_holds h WHERE h.transaction_id=v_existing.id;
    RETURN QUERY SELECT v_existing.id, v_hold, v_existing.total_micros,
      COALESCE((SELECT wb.balance_cents::bigint * 10000 FROM public.wallet_balances wb WHERE wb.user_id=_user_id),0), true;
    RETURN;
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

CREATE OR REPLACE FUNCTION public.billing_settle(_transaction_id uuid, _actual_provider_cost_micros bigint, _provider_request_id text DEFAULT NULL::text, _usage jsonb DEFAULT '[]'::jsonb, _metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS TABLE(total_billed_cents integer, new_balance_cents integer, platform_fee_micros bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  SELECT * INTO v_tx FROM public.billing_transactions t WHERE t.id=_transaction_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'billing transaction not found'; END IF;
  IF v_tx.status='settled' THEN
    SELECT wb.balance_cents INTO v_balance FROM public.wallet_balances wb WHERE wb.user_id=v_tx.user_id;
    RETURN QUERY SELECT CEIL(v_tx.total_micros/10000.0)::integer,v_balance,v_tx.platform_fee_micros;
    RETURN;
  END IF;
  IF v_tx.status <> 'held' THEN RAISE EXCEPTION 'billing transaction is not settleable'; END IF;
  SELECT * INTO v_hold FROM public.billing_holds h WHERE h.transaction_id=_transaction_id FOR UPDATE;
  SELECT wb.balance_cents INTO v_balance FROM public.wallet_balances wb WHERE wb.user_id=v_tx.user_id FOR UPDATE;
  v_total := v_provider+v_fee;
  v_total_cents := CEIL(v_total/10000.0)::integer;
  IF v_balance < v_total_cents THEN RAISE EXCEPTION USING ERRCODE='P0001', MESSAGE='insufficient_funds_at_settlement'; END IF;
  UPDATE public.wallet_balances wb SET balance_cents=wb.balance_cents-v_total_cents,updated_at=now() WHERE wb.user_id=v_tx.user_id RETURNING wb.balance_cents INTO v_balance;
  UPDATE public.billing_transactions t SET status='settled',provider_cost_micros=v_provider,platform_fee_micros=v_fee,total_micros=v_total,provider_request_id=_provider_request_id,metadata=t.metadata||COALESCE(_metadata,'{}'::jsonb),settled_at=now() WHERE t.id=_transaction_id;
  UPDATE public.billing_holds h SET status='settled',released_at=now() WHERE h.transaction_id=_transaction_id;
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
$function$;