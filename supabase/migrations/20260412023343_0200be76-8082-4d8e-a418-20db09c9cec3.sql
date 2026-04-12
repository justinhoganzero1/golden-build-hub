
-- Drop the existing INSERT policy
DROP POLICY IF EXISTS "Anyone can submit creator comments" ON public.creator_comments;

-- Recreate with moderation_status enforcement
CREATE POLICY "Anyone can submit creator comments"
ON public.creator_comments FOR INSERT TO public
WITH CHECK (
  length(trim(commenter_name)) > 0
  AND length(trim(message)) > 0
  AND (commenter_email IS NULL OR length(trim(commenter_email)) > 0)
  AND moderation_status = 'pending'
  AND ai_moderation_notes IS NULL
);
