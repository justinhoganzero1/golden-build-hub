
-- Create a security definer function to check if user is owner
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = 'justinbretthogan@gmail.com'
  )
$$;

-- Allow owner to view all user_media
CREATE POLICY "Owner can view all media"
ON public.user_media
FOR SELECT
TO authenticated
USING (public.is_owner());

-- Allow owner to delete any user_media
CREATE POLICY "Owner can delete any media"
ON public.user_media
FOR DELETE
TO authenticated
USING (public.is_owner());
