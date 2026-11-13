CREATE OR REPLACE FUNCTION public.validate_profile_birthday()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.date_of_birth IS NOT NULL THEN
    IF NEW.date_of_birth < DATE '1900-01-01' THEN
      RAISE EXCEPTION 'Please enter a real birthday.';
    END IF;
    IF NEW.date_of_birth > (CURRENT_DATE - INTERVAL '16 years')::date THEN
      RAISE EXCEPTION 'You must be at least 16 years old to use Oracle Lunar.';
    END IF;
  END IF;

  -- Once a member has given their birthday it can't be changed from the app
  -- (stops someone re-entering a different age). Server jobs and the owner may correct it.
  IF TG_OP = 'UPDATE'
     AND OLD.date_of_birth IS NOT NULL
     AND NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth
     AND auth.uid() IS NOT NULL
     AND NOT public.is_owner() THEN
    RAISE EXCEPTION 'Your birthday is already saved and can''t be changed here.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_validate_birthday ON public.profiles;
CREATE TRIGGER profiles_validate_birthday
  BEFORE INSERT OR UPDATE OF date_of_birth ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.validate_profile_birthday();