
-- Lock wallet_balances INSERT to zero balance
DROP POLICY IF EXISTS "Users insert own wallet" ON public.wallet_balances;
CREATE POLICY "Users insert own wallet"
ON public.wallet_balances
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND COALESCE(balance_cents, 0) = 0
  AND COALESCE(currency, 'AUD') = 'AUD'
);

-- Lock referrals INSERT to pending / non-rewarded state
DROP POLICY IF EXISTS "Users can create referrals" ON public.referrals;
CREATE POLICY "Users can create referrals"
ON public.referrals
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = referrer_id
  AND COALESCE(status, 'pending') = 'pending'
  AND COALESCE(reward_granted, false) = false
  AND granted_to_user_id IS NULL
  AND qualifies_at IS NULL
  AND friend_subscribed_at IS NULL
  AND reward_granted_at IS NULL
);
