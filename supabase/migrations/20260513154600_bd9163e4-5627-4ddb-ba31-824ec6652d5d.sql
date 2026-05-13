-- Trigger to fire stripe-event-alert edge function when a stripe_event_log row
-- is inserted with an error status. Uses pg_net for async HTTP call.
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.notify_stripe_event_error()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  function_url text := 'https://tpkpfkcnqdyrzpqdoqnp.supabase.co/functions/v1/stripe-event-alert';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwa3Bma2NucWR5cnpwcWRvcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDIyMjAsImV4cCI6MjA5MTIxODIyMH0.gq7OXot4gtcJpmDin3fCLz7fxrQDsfgXQM5ym2ZB9Is';
BEGIN
  IF NEW.status NOT IN ('error', 'signature_failed') THEN
    RETURN NEW;
  END IF;
  -- Avoid recursive alerting on rows the alert function itself writes
  IF NEW.source = 'alert' THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || anon_key
    ),
    body := jsonb_build_object('record', to_jsonb(NEW))
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the original insert if alerting fails
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stripe_event_error_alert ON public.stripe_event_log;
CREATE TRIGGER trg_stripe_event_error_alert
AFTER INSERT ON public.stripe_event_log
FOR EACH ROW
EXECUTE FUNCTION public.notify_stripe_event_error();