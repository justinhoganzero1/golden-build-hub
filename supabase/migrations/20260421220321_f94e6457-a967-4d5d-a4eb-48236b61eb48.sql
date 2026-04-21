-- Lock the admin role to ONLY the owner email at the database level.
-- Even if someone manages to insert a row into user_roles for themselves,
-- has_role() will return false unless their auth.users.email matches.
-- This is the final safety net behind the frontend + edge function checks.

CREATE OR REPLACE FUNCTION public.is_owner_email_locked()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND lower(trim(email)) = 'justinbretthogan@gmail.com'
  );
$$;

-- Re-bind has_role so admin role ONLY applies if the email is the owner.
-- Other roles (moderator, user, investigator) keep working normally.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    CASE
      WHEN _role = 'admin'::app_role THEN
        EXISTS (
          SELECT 1
          FROM public.user_roles ur
          JOIN auth.users u ON u.id = ur.user_id
          WHERE ur.user_id = _user_id
            AND ur.role = 'admin'::app_role
            AND lower(trim(u.email)) = 'justinbretthogan@gmail.com'
        )
      ELSE
        EXISTS (
          SELECT 1
          FROM public.user_roles
          WHERE user_id = _user_id
            AND role = _role
        )
    END;
$$;

-- Trigger: prevent anyone from inserting an 'admin' row in user_roles
-- unless their email matches the owner email. Belt-and-suspenders against
-- a leaked service role key being used to grant admin.
CREATE OR REPLACE FUNCTION public.guard_admin_role_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email text;
BEGIN
  IF NEW.role = 'admin'::app_role THEN
    SELECT lower(trim(email)) INTO v_email
    FROM auth.users WHERE id = NEW.user_id;
    IF v_email IS DISTINCT FROM 'justinbretthogan@gmail.com' THEN
      RAISE EXCEPTION 'admin role is locked to the owner email only';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_admin_role_assignment_trg ON public.user_roles;
CREATE TRIGGER guard_admin_role_assignment_trg
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_admin_role_assignment();