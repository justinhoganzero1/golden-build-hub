-- Allow authenticated users to read their own role rows so the client can check admin status
CREATE POLICY "Users can read own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Grant execute on helper functions used in RLS so the client (and other policies) can call them
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated, anon;