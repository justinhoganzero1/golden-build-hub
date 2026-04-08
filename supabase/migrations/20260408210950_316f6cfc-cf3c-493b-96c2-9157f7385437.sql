-- Create a public-safe view that excludes commenter_email
CREATE OR REPLACE VIEW public.creator_comments_public
WITH (security_invoker = on) AS
SELECT id, commenter_name, message, moderation_status, created_at
FROM public.creator_comments
WHERE moderation_status = 'approved';

-- Replace the public SELECT policy to block direct table reads for non-owners
DROP POLICY IF EXISTS "Anyone can view approved comments" ON public.creator_comments;

CREATE POLICY "Anyone can view approved comments"
ON public.creator_comments
FOR SELECT
TO public
USING (false);
