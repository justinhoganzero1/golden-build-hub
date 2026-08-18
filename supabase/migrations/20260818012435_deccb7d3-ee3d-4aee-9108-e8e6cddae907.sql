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
  v_unit text;
  v_allowed text[] := ARRAY['input_token','output_token','character','image','audio_second','video_second','call_minute','sms_segment','compute_second','storage_gb','bandwidth_gb','request'];
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
      v_unit := COALESCE(v_item->>'unit_type','request');
      IF NOT (v_unit = ANY(v_allowed)) THEN v_unit := 'request'; END IF;
      INSERT INTO public.usage_events(transaction_id,user_id,service,provider,model,unit_type,quantity,unit_cost_micros,provider_cost_micros,provider_request_id,metadata)
      VALUES(_transaction_id,v_tx.user_id,v_tx.service,v_tx.provider,v_tx.model,
        v_unit,COALESCE((v_item->>'quantity')::numeric,0),COALESCE((v_item->>'unit_cost_micros')::numeric,0),COALESCE((v_item->>'provider_cost_micros')::bigint,0),_provider_request_id,
        COALESCE(v_item->'metadata','{}'::jsonb) || CASE WHEN COALESCE(v_item->>'unit_type','request') = v_unit THEN '{}'::jsonb ELSE jsonb_build_object('original_unit_type', v_item->>'unit_type') END);
    END LOOP;
  END IF;
  RETURN QUERY SELECT v_total_cents,v_balance,v_fee;
END;
$function$;