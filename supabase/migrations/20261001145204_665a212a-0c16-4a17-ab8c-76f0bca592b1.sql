CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE _dob date;
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user'::public.app_role) ON CONFLICT DO NOTHING;
  INSERT INTO public.memberships (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  BEGIN
    _dob := NULLIF(NEW.raw_user_meta_data->>'date_of_birth','')::date;
  EXCEPTION WHEN OTHERS THEN _dob := NULL;
  END;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = NEW.id) THEN
    INSERT INTO public.profiles (user_id, date_of_birth) VALUES (NEW.id, _dob);
  END IF;
  BEGIN
    PERFORM public.grant_signup_welcome(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'grant_signup_welcome failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END; $function$;