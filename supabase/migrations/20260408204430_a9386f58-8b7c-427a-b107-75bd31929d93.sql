
-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Anyone can view approved comments" ON public.creator_comments;

-- Owner can see everything
CREATE POLICY "Owner can view all comments"
ON public.creator_comments
FOR SELECT
TO authenticated
USING (public.is_owner());

-- Public can view approved comments (email is in the row but we'll handle via a view)
-- For now, allow approved comments to be read by anyone
CREATE POLICY "Anyone can view approved comments"
ON public.creator_comments
FOR SELECT
USING (moderation_status = 'approved');
