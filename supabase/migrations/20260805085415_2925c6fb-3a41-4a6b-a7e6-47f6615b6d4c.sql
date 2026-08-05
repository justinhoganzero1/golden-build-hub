-- 1. Trigger function must not be callable via the API
REVOKE ALL ON FUNCTION public.protect_user_realms_moderation() FROM PUBLIC, anon, authenticated;

-- 2. ai_charges: scope SELECT to authenticated, owner or self
DROP POLICY IF EXISTS "Users view own ai charges" ON public.ai_charges;
CREATE POLICY "Users view own ai charges"
ON public.ai_charges FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_owner());

-- 3. creator_comments: no anonymous reads of commenter emails ever
REVOKE SELECT, UPDATE, DELETE ON public.creator_comments FROM anon;
GRANT INSERT ON public.creator_comments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_comments TO authenticated;
GRANT ALL ON public.creator_comments TO service_role;

-- 4. investment_offers: always tied to a submitter
ALTER TABLE public.investment_offers ALTER COLUMN user_id SET NOT NULL;