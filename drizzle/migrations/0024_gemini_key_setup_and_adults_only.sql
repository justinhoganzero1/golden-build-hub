-- Adults only: Google's Gemini key rules need 18+.
CREATE OR REPLACE FUNCTION public.validate_profile_birthday()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.date_of_birth IS NOT NULL THEN
    IF NEW.date_of_birth < DATE '1900-01-01' THEN
      RAISE EXCEPTION 'Please enter a real birthday.';
    END IF;
    IF NEW.date_of_birth > (CURRENT_DATE - INTERVAL '18 years')::date THEN
      RAISE EXCEPTION 'You must be at least 18 years old to use Oracle Lunar.';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.date_of_birth IS NOT NULL
     AND NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth
     AND auth.uid() IS NOT NULL
     AND NOT public.is_owner() THEN
    RAISE EXCEPTION 'Your birthday is already saved and can''t be changed here.';
  END IF;

  RETURN NEW;
END;
$function$;

-- Whether a member has finished the Gemini key setup (written only by the server).
CREATE TABLE public.member_ai_setup (
  user_id uuid PRIMARY KEY,
  gemini_verified_at timestamptz,
  consent_version text,
  key_status text NOT NULL DEFAULT 'ok' CHECK (key_status IN ('ok','failed')),
  key_problem text,
  key_problem_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.member_ai_setup TO authenticated;
GRANT ALL ON public.member_ai_setup TO service_role;
ALTER TABLE public.member_ai_setup ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own ai setup" ON public.member_ai_setup FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner reads all ai setup" ON public.member_ai_setup FOR SELECT TO authenticated USING (public.is_owner());

-- Permanent record of every consent a member gives during key setup (kept for legal needs).
CREATE TABLE public.ai_key_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_email text,
  consent_version text NOT NULL,
  step text NOT NULL,
  notice_text text NOT NULL,
  method text NOT NULL CHECK (method IN ('tap','voice')),
  spoken_words text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_key_consents TO authenticated;
GRANT ALL ON public.ai_key_consents TO service_role;
ALTER TABLE public.ai_key_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own consents" ON public.ai_key_consents FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "owner reads all consents" ON public.ai_key_consents FOR SELECT TO authenticated USING (public.is_owner());
CREATE INDEX ai_key_consents_user_idx ON public.ai_key_consents (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.block_consent_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $$
BEGIN
  RAISE EXCEPTION 'Consent records are permanent and cannot be changed or deleted.';
END;
$$;
CREATE TRIGGER ai_key_consents_permanent
  BEFORE UPDATE OR DELETE ON public.ai_key_consents
  FOR EACH ROW EXECUTE FUNCTION public.block_consent_changes();

-- A key changed outside the checked setup must be checked again.
CREATE OR REPLACE FUNCTION public.reset_gemini_setup_on_key_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.gemini_key IS DISTINCT FROM OLD.gemini_key
     AND coalesce(auth.role(), '') <> 'service_role' THEN
    UPDATE public.member_ai_setup
       SET gemini_verified_at = NULL, updated_at = now()
     WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER user_ai_keys_reset_gemini_setup
  AFTER UPDATE OF gemini_key ON public.user_ai_keys
  FOR EACH ROW EXECUTE FUNCTION public.reset_gemini_setup_on_key_change();