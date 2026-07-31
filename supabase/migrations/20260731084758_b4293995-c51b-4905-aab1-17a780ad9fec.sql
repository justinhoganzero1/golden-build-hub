DROP POLICY IF EXISTS "Admins can view all role assignments" ON public.user_roles;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;