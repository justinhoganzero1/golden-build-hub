-- 1) Stop leaking commenter emails publicly via creator_comments_public view
--    The view already exists and EXCLUDES commenter_email. The base table SELECT
--    policy "Anyone can view approved comments" exposes the email column.
--    Replace it: deny direct public access to base table; public can read the view only.
DROP POLICY IF EXISTS "Anyone can view approved comments" ON public.creator_comments;

-- 2) Bind investment offers to the submitting user
ALTER TABLE public.investment_offers
  ADD COLUMN IF NOT EXISTS user_id uuid;

-- Backfill is not possible (no submitter known historically) — leave existing rows null.

DROP POLICY IF EXISTS "Authenticated users can submit investment offers" ON public.investment_offers;
CREATE POLICY "Authenticated users can submit investment offers"
  ON public.investment_offers
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND length(trim(investor_name)) > 0
    AND length(trim(investor_email)) > 0
    AND length(trim(message)) > 0
    AND (offer_amount IS NULL OR length(trim(offer_amount)) > 0)
  );

-- Allow submitter to view their own offers (admin already has full access via is_owner)
CREATE POLICY "Submitters can view own investment offers"
  ON public.investment_offers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 3) Harden has_role() — restrict EXECUTE so users cannot probe other users' roles
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM public, anon, authenticated;
-- Internal SECURITY DEFINER callers (is_owner, RLS policies) execute as definer; explicit grants not needed.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO service_role;