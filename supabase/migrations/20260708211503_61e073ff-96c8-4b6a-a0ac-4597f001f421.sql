
-- Admin visibility over user records for the user list panel
CREATE POLICY "Admins view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.is_owner());
CREATE POLICY "Admins view all wallets" ON public.wallet_balances FOR SELECT TO authenticated USING (public.is_owner());
CREATE POLICY "Admins view all reward grants" ON public.reward_grants FOR SELECT TO authenticated USING (public.is_owner());
CREATE POLICY "Admins update all reward grants" ON public.reward_grants FOR UPDATE TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "Admins insert reward grants" ON public.reward_grants FOR INSERT TO authenticated WITH CHECK (public.is_owner());

-- Admin RPC: list users with wallet + reward info
CREATE OR REPLACE FUNCTION public.admin_list_users(_search text DEFAULT NULL, _limit int DEFAULT 100, _offset int DEFAULT 0)
RETURNS TABLE(user_id uuid, email text, display_name text, created_at timestamptz, balance_cents int, total_spent_cents bigint, free_for_life boolean, last_charge_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'not authorized'; END IF;
  RETURN QUERY
  SELECT u.id,
         u.email::text,
         p.display_name,
         u.created_at,
         COALESCE(w.balance_cents, 0),
         COALESCE((SELECT SUM(total_cents)::bigint FROM public.ai_charges c WHERE c.user_id = u.id), 0),
         EXISTS(SELECT 1 FROM public.reward_grants r WHERE r.user_id = u.id AND r.active AND r.expires_at > now() AND r.reward_type IN ('free_for_life','unlimited_ai')),
         (SELECT MAX(c.created_at) FROM public.ai_charges c WHERE c.user_id = u.id)
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.user_id = u.id
  LEFT JOIN public.wallet_balances w ON w.user_id = u.id
  WHERE _search IS NULL OR _search = '' OR u.email ILIKE '%'||_search||'%' OR p.display_name ILIKE '%'||_search||'%'
  ORDER BY u.created_at DESC
  LIMIT GREATEST(1, _limit) OFFSET GREATEST(0, _offset);
END; $$;

-- Admin RPC: top up any user
CREATE OR REPLACE FUNCTION public.admin_topup_user(_user_id uuid, _amount_cents int, _note text DEFAULT NULL)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_new int;
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _amount_cents = 0 THEN RAISE EXCEPTION 'amount must be non-zero'; END IF;
  v_new := public.wallet_topup_logged(_user_id, _amount_cents, _amount_cents, 0, 'admin_grant', NULL, NULL,
    jsonb_build_object('granted_by', auth.uid(), 'note', COALESCE(_note,'')));
  RETURN v_new;
END; $$;

-- Admin RPC: set exact wallet balance
CREATE OR REPLACE FUNCTION public.admin_set_wallet_balance(_user_id uuid, _cents int)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_current int; v_delta int;
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'not authorized'; END IF;
  INSERT INTO public.wallet_balances (user_id, balance_cents) VALUES (_user_id, 0)
    ON CONFLICT (user_id) DO NOTHING;
  SELECT balance_cents INTO v_current FROM public.wallet_balances WHERE user_id = _user_id;
  v_delta := _cents - COALESCE(v_current, 0);
  PERFORM public.admin_topup_user(_user_id, v_delta, 'admin_set_balance');
  RETURN _cents;
END; $$;

-- Admin RPC: toggle free-for-life
CREATE OR REPLACE FUNCTION public.admin_set_free_for_life(_user_id uuid, _enabled boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner() THEN RAISE EXCEPTION 'not authorized'; END IF;
  IF _enabled THEN
    UPDATE public.reward_grants SET active = false
      WHERE user_id = _user_id AND reward_type IN ('free_for_life','unlimited_ai');
    INSERT INTO public.reward_grants (user_id, reward_type, reason, starts_at, expires_at, active)
    VALUES (_user_id, 'free_for_life', 'admin_grant', now(), now() + interval '100 years', true);
  ELSE
    UPDATE public.reward_grants SET active = false, updated_at = now()
      WHERE user_id = _user_id AND reward_type IN ('free_for_life','unlimited_ai') AND active = true;
  END IF;
  RETURN _enabled;
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_list_users(text,int,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_topup_user(uuid,int,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_wallet_balance(uuid,int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_free_for_life(uuid,boolean) TO authenticated;
