CREATE OR REPLACE FUNCTION public.protect_user_realms_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_owner() OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;
  NEW.moderation_status := OLD.moderation_status;
  NEW.moderation_notes := OLD.moderation_notes;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_user_realms_moderation ON public.user_realms;
CREATE TRIGGER trg_protect_user_realms_moderation
BEFORE UPDATE ON public.user_realms
FOR EACH ROW EXECUTE FUNCTION public.protect_user_realms_moderation();