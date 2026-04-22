-- Trigger function: provisions every new auth user with default role + welcome reward
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Default role (idempotent)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user'::public.app_role)
  ON CONFLICT DO NOTHING;

  -- Welcome reward / trial access
  BEGIN
    PERFORM public.grant_signup_welcome(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    -- Never block signup if reward grant fails; log via NOTICE
    RAISE NOTICE 'grant_signup_welcome failed for %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Drop any prior versions to avoid duplicates, then attach
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();