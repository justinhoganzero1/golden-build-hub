-- Reward grants table: tracks free Tier 3 access periods granted to users
CREATE TABLE public.reward_grants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  reward_type TEXT NOT NULL DEFAULT 'tier3_trial',
  reason TEXT NOT NULL,
  source_referral_id UUID,
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reward_grants_user_active ON public.reward_grants(user_id, active, expires_at);

ALTER TABLE public.reward_grants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own reward grants"
ON public.reward_grants FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Owner views all reward grants"
ON public.reward_grants FOR SELECT
TO authenticated
USING (is_owner());

-- No direct insert/update/delete by users — only service role / SECURITY DEFINER funcs

-- Extend referrals table to track qualifying paid subscription
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS granted_to_user_id UUID,
  ADD COLUMN IF NOT EXISTS qualifying_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS friend_subscribed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS qualifies_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reward_granted_at TIMESTAMPTZ;

-- Helper: does this user currently have an active Tier 3 reward?
CREATE OR REPLACE FUNCTION public.has_active_reward(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reward_grants
    WHERE user_id = _user_id
      AND active = true
      AND expires_at > now()
  );
$$;

-- Grant the signup welcome gift: 30 days of Tier 3
CREATE OR REPLACE FUNCTION public.grant_signup_welcome(_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_existing UUID;
BEGIN
  -- Don't double-grant
  SELECT id INTO v_existing FROM public.reward_grants
  WHERE user_id = _user_id AND reason = 'signup_welcome' LIMIT 1;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO public.reward_grants (user_id, reward_type, reason, starts_at, expires_at)
  VALUES (_user_id, 'tier3_trial', 'signup_welcome', now(), now() + INTERVAL '30 days')
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Grant a referral reward: 30 days Tier 3 to the referrer (stacks by extending expiry)
CREATE OR REPLACE FUNCTION public.grant_referral_reward(_referral_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_referrer UUID;
  v_existing_expiry TIMESTAMPTZ;
  v_grant_id UUID;
  v_already_granted BOOLEAN;
BEGIN
  SELECT referrer_id, reward_granted_at IS NOT NULL
    INTO v_referrer, v_already_granted
  FROM public.referrals WHERE id = _referral_id;

  IF v_referrer IS NULL OR v_already_granted THEN
    RETURN NULL;
  END IF;

  -- If referrer already has an active Tier 3 reward, extend it; otherwise create new
  SELECT expires_at INTO v_existing_expiry
  FROM public.reward_grants
  WHERE user_id = v_referrer AND reward_type = 'tier3_trial' AND active = true AND expires_at > now()
  ORDER BY expires_at DESC LIMIT 1;

  IF v_existing_expiry IS NOT NULL THEN
    UPDATE public.reward_grants
    SET expires_at = expires_at + INTERVAL '30 days', updated_at = now()
    WHERE user_id = v_referrer AND reward_type = 'tier3_trial' AND active = true
      AND expires_at = v_existing_expiry
    RETURNING id INTO v_grant_id;
  ELSE
    INSERT INTO public.reward_grants (user_id, reward_type, reason, source_referral_id, starts_at, expires_at)
    VALUES (v_referrer, 'tier3_trial', 'referral_paid', _referral_id, now(), now() + INTERVAL '30 days')
    RETURNING id INTO v_grant_id;
  END IF;

  UPDATE public.referrals
  SET reward_granted = true, reward_granted_at = now(), status = 'rewarded'
  WHERE id = _referral_id;

  RETURN v_grant_id;
END;
$$;

-- Trigger to keep updated_at fresh
CREATE TRIGGER update_reward_grants_updated_at
BEFORE UPDATE ON public.reward_grants
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();