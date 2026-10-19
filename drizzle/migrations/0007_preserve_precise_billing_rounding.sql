CREATE OR REPLACE FUNCTION public.enforce_ai_charge_margin_floor() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 -- The authoritative total is checked in micro-units on billing_transactions.
 -- Rounded display components can sum one cent above that total; do not charge twice for rounding.
 IF NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=NEW.user_id AND role='admin') AND NEW.platform_fee_cents<ceil(NEW.provider_cost_cents::numeric*0.20) THEN RAISE EXCEPTION 'billing_margin_floor: provider cost plus at least 20 percent is required'; END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.enforce_ai_charge_margin_floor() FROM PUBLIC,anon,authenticated;