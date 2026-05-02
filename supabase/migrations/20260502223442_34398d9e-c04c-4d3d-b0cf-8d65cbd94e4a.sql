-- Backfill normal member role for every existing account.
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'user'::public.app_role
FROM auth.users u
ON CONFLICT (user_id, role) DO NOTHING;

-- Backfill wallet rows for every existing account so coin paywalls always have a balance record.
INSERT INTO public.wallet_balances (user_id, balance_cents)
SELECT u.id, 0
FROM auth.users u
ON CONFLICT (user_id) DO NOTHING;

-- Make the welcome grant the single self-healing membership initializer.
-- This is called by the app after sign-in and remains idempotent.
CREATE OR REPLACE FUNCTION public.grant_signup_welcome(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_grant uuid;
BEGIN
  -- Every authenticated account is a member in the coin economy.
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'user'::public.app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Ensure the wallet exists before any AI/paywall code touches it.
  INSERT INTO public.wallet_balances (user_id, balance_cents)
  VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- Idempotency: if we've already welcomed this user, do nothing.
  SELECT id INTO v_existing_grant
  FROM public.reward_grants
  WHERE user_id = _user_id AND reason = 'signup_welcome_coins'
  LIMIT 1;

  IF v_existing_grant IS NOT NULL THEN
    RETURN v_existing_grant;
  END IF;

  -- 10 coins one time. Internal wallet cents: 10 coins at 5.37 coins / $1 = 186 cents.
  PERFORM public.wallet_topup(_user_id, 186);

  INSERT INTO public.reward_grants (user_id, reward_type, reason, starts_at, expires_at, active)
  VALUES (_user_id, 'signup_coins_10', 'signup_welcome_coins', now(), now() + interval '100 years', true)
  RETURNING id INTO v_existing_grant;

  RETURN v_existing_grant;
END;
$function$;