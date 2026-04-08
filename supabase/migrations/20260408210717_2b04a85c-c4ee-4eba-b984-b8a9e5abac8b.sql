DROP POLICY IF EXISTS "Admins can create role assignments" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update role assignments" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete role assignments" ON public.user_roles;

DROP POLICY IF EXISTS "Anyone can view approved comments" ON public.creator_comments;
CREATE POLICY "Anyone can view approved comments"
ON public.creator_comments
FOR SELECT
TO public
USING (
  moderation_status = 'approved'
  AND commenter_email IS NULL
);

DROP POLICY IF EXISTS "Users can update own suggestions" ON public.suggestions;