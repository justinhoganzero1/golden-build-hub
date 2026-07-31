CREATE OR REPLACE FUNCTION public.is_anon_visitor(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN _user_id IS NULL OR _user_id <> auth.uid() THEN false
    ELSE COALESCE((SELECT is_anonymous FROM auth.users WHERE id = _user_id), false)
  END;
$$;

COMMENT ON FUNCTION public.is_anon_visitor(uuid) IS
  'SECURITY DEFINER: reads auth.users. Scoped to the caller only; returns false for any other user id.';

COMMENT ON FUNCTION public.admin_list_users(text, integer, integer) IS
  'SECURITY DEFINER: gated by is_owner() at the top of the body.';
COMMENT ON FUNCTION public.is_owner_email_locked() IS
  'SECURITY DEFINER: no arguments, evaluates only auth.uid(); cannot be probed for other users.';
