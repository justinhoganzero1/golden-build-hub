CREATE OR REPLACE FUNCTION public.grant_signup_welcome(_user_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- Pay-per-use: every member gets their own role + empty wallet. No free coins.
  INSERT INTO public.user_roles (user_id, role) VALUES (_user_id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;
  INSERT INTO public.wallet_balances (user_id, balance_cents) VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.has_unlimited_ai(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user_id IS NULL OR (_user_id <> auth.uid() AND NOT public.is_owner() AND auth.role() <> 'service_role') THEN false
    ELSE public.has_role(_user_id, 'admin'::public.app_role)
  END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_ai_tier(_user_id uuid)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.has_role(_user_id, 'admin'::public.app_role) THEN 'admin'
    WHEN EXISTS (SELECT 1 FROM public.wallet_balances w WHERE w.user_id = _user_id AND w.balance_cents > 0) THEN 'paying'
    ELSE 'free'
  END;
$function$;

CREATE OR REPLACE FUNCTION public.grant_referral_reward(_referral_id uuid)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- Referral rewards no longer grant free AI usage (pay-per-use only).
  UPDATE public.referrals SET status = 'completed' WHERE id = _referral_id AND reward_granted_at IS NULL;
  RETURN NULL;
END;
$function$;