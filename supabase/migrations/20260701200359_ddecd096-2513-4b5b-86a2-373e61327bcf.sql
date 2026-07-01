GRANT EXECUTE ON FUNCTION public.is_owner() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;