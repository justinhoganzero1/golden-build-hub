CREATE OR REPLACE FUNCTION public.protect_investment_offer_ai_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Owner/admin may set these freely.
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  -- Service role (edge functions / AI evaluator) may set these freely.
  IF coalesce(current_setting('request.jwt.claims', true)::json->>'role', '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.ai_score := NULL;
    NEW.ai_notes := NULL;
  ELSE
    NEW.ai_score := OLD.ai_score;
    NEW.ai_notes := OLD.ai_notes;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_investment_offer_ai_fields ON public.investment_offers;
CREATE TRIGGER trg_protect_investment_offer_ai_fields
BEFORE INSERT OR UPDATE ON public.investment_offers
FOR EACH ROW EXECUTE FUNCTION public.protect_investment_offer_ai_fields();

REVOKE EXECUTE ON FUNCTION public.protect_investment_offer_ai_fields() FROM anon, authenticated;