CREATE OR REPLACE FUNCTION public.protect_suggestion_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.is_owner() THEN
      NEW.granted_free_access := false;
      NEW.ai_quality_score := 0;
      NEW.ai_response := NULL;
      NEW.status := 'pending';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT public.is_owner() THEN
    NEW.granted_free_access := OLD.granted_free_access;
    NEW.ai_quality_score := OLD.ai_quality_score;
    NEW.ai_response := OLD.ai_response;
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.protect_suggestion_privileged_columns() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.protect_suggestion_privileged_columns() FROM anon;
REVOKE EXECUTE ON FUNCTION public.protect_suggestion_privileged_columns() FROM authenticated;

DROP TRIGGER IF EXISTS protect_suggestions_privileged ON public.suggestions;
DROP TRIGGER IF EXISTS protect_suggestions_privileged_insert ON public.suggestions;

CREATE TRIGGER protect_suggestions_privileged_insert
BEFORE INSERT ON public.suggestions
FOR EACH ROW
EXECUTE FUNCTION public.protect_suggestion_privileged_columns();

CREATE TRIGGER protect_suggestions_privileged
BEFORE UPDATE ON public.suggestions
FOR EACH ROW
EXECUTE FUNCTION public.protect_suggestion_privileged_columns();