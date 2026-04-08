-- Lock down user_roles: deny all writes via RLS
-- INSERT: deny all (only service_role / direct DB access can insert)
CREATE POLICY "No public inserts on user_roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (false);

-- UPDATE: deny all
CREATE POLICY "No public updates on user_roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

-- DELETE: deny all
CREATE POLICY "No public deletes on user_roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (false);

-- Allow users to delete their own suggestions
CREATE POLICY "Users can delete own suggestions"
ON public.suggestions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Fix public comment visibility: use the view approach but allow approved reads without email
DROP POLICY IF EXISTS "Anyone can view approved comments" ON public.creator_comments;
CREATE POLICY "Anyone can view approved comments"
ON public.creator_comments
FOR SELECT
TO public
USING (moderation_status = 'approved');