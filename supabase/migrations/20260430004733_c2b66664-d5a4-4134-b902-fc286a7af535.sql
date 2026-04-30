-- Replace the welcome grant: drop 10 coins into the user's wallet instead of a 30-day trial.
CREATE OR REPLACE FUNCTION public.grant_signup_welcome(_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_existing_grant uuid;
BEGIN
  -- Idempotency: if we've already welcomed this user, do nothing.
  SELECT id INTO v_existing_grant FROM public.reward_grants
  WHERE user_id = _user_id AND reason = 'signup_welcome_coins' LIMIT 1;
  IF v_existing_grant IS NOT NULL THEN
    RETURN v_existing_grant;
  END IF;

  -- Drop 10 coins (~$1.86 USD value at 5.37 coins / $1) into their wallet.
  -- Wallet is stored in cents; 10 coins == 186 cents internal credit.
  PERFORM public.wallet_topup(_user_id, 186);

  -- Record the grant for auditability (uses the existing reward_grants table).
  INSERT INTO public.reward_grants (user_id, reward_type, reason, starts_at, expires_at, active)
  VALUES (_user_id, 'signup_coins_10', 'signup_welcome_coins', now(), now() + interval '100 years', true)
  RETURNING id INTO v_existing_grant;

  RETURN v_existing_grant;
END;
$function$;