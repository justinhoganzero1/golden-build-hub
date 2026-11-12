ALTER TABLE public.shop_purchases ADD COLUMN IF NOT EXISTS wallet_credited_at timestamptz;

CREATE OR REPLACE FUNCTION public.credit_creator_sale(_purchase_id uuid)
RETURNS TABLE(credited boolean, creator_id uuid, amount_cents integer, new_balance_cents integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE p public.shop_purchases%ROWTYPE; v_id uuid; v_balance integer; v_micros bigint;
BEGIN
  SELECT * INTO p FROM public.shop_purchases WHERE id = _purchase_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'purchase not found'; END IF;
  IF p.status <> 'paid' THEN RAISE EXCEPTION 'purchase not paid'; END IF;
  IF p.wallet_credited_at IS NOT NULL THEN
    SELECT w.balance_cents INTO v_balance FROM public.wallet_balances w WHERE w.user_id = p.creator_id;
    RETURN QUERY SELECT false, p.creator_id, p.creator_payout_cents, COALESCE(v_balance, 0);
    RETURN;
  END IF;
  IF p.creator_id IS NULL OR p.creator_payout_cents IS NULL OR p.creator_payout_cents <= 0 THEN
    RAISE EXCEPTION 'nothing to credit';
  END IF;
  -- The creator share can never exceed 80% of the sale price.
  IF p.creator_payout_cents > floor(p.amount_cents * 0.8) THEN
    RAISE EXCEPTION 'creator share above 80 percent';
  END IF;

  INSERT INTO public.wallet_balances(user_id, balance_cents) VALUES (p.creator_id, 0) ON CONFLICT (user_id) DO NOTHING;
  PERFORM 1 FROM public.wallet_balances w WHERE w.user_id = p.creator_id FOR UPDATE;

  INSERT INTO public.wallet_topups(user_id, amount_cents, gross_cents, fee_cents, source, metadata)
  VALUES (p.creator_id, p.creator_payout_cents, p.amount_cents, COALESCE(p.platform_fee_cents, 0), 'creator_sale',
          jsonb_build_object('purchase_id', p.id, 'item_kind', p.item_kind, 'item_id', p.item_id, 'buyer_session', p.stripe_session_id));

  v_micros := p.creator_payout_cents::bigint * 10000;
  INSERT INTO public.billing_transactions(user_id, request_key, transaction_type, status, service, total_micros, currency, metadata, settled_at)
  VALUES (p.creator_id, 'creator_sale:' || p.id, 'topup', 'settled', 'creator_shop', v_micros, 'USD',
          jsonb_build_object('purchase_id', p.id, 'item_kind', p.item_kind, 'item_id', p.item_id, 'sale_cents', p.amount_cents), now())
  RETURNING id INTO v_id;

  UPDATE public.wallet_balances w SET balance_cents = w.balance_cents + p.creator_payout_cents, updated_at = now()
  WHERE w.user_id = p.creator_id RETURNING w.balance_cents INTO v_balance;

  INSERT INTO public.billing_ledger_entries(transaction_id, user_id, account_type, amount_micros) VALUES
    (v_id, p.creator_id, 'user_wallet', v_micros),
    (v_id, p.creator_id, 'stripe_clearing', -v_micros);

  UPDATE public.shop_purchases SET wallet_credited_at = now() WHERE id = p.id;
  RETURN QUERY SELECT true, p.creator_id, p.creator_payout_cents, v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_creator_sale(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.credit_creator_sale(uuid) TO service_role;

-- Cash payouts only cover sales that were NOT already paid into the wallet.
CREATE OR REPLACE FUNCTION public.seller_available_balance(user_uuid uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select greatest(0,
    coalesce((
      select sum(creator_payout_cents) from public.shop_purchases
      where creator_id = user_uuid and status = 'paid' and wallet_credited_at is null
    ), 0)
    + coalesce((
      select sum(price_cents) from public.founder_seat_listings
      where seller_id = user_uuid and status = 'sold'
    ), 0)
    - coalesce((
      select sum(amount_cents) from public.payout_requests
      where user_id = user_uuid and status in ('pending','paid')
    ), 0)
  );
$$;