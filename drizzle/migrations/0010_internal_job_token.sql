CREATE TABLE IF NOT EXISTS public.internal_job_tokens (
  name text PRIMARY KEY,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.internal_job_tokens TO service_role;
REVOKE ALL ON public.internal_job_tokens FROM anon, authenticated;
ALTER TABLE public.internal_job_tokens ENABLE ROW LEVEL SECURITY;
INSERT INTO public.internal_job_tokens(name) VALUES ('scheduler') ON CONFLICT (name) DO NOTHING;

CREATE OR REPLACE FUNCTION public.internal_job_token()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT token FROM public.internal_job_tokens WHERE name = 'scheduler'
$$;
REVOKE ALL ON FUNCTION public.internal_job_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.internal_job_token() TO service_role;

CREATE OR REPLACE FUNCTION public.notify_stripe_event_error()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('error', 'signature_failed') OR NEW.source = 'alert' THEN
    RETURN NEW;
  END IF;
  PERFORM net.http_post(
    url := 'https://tpkpfkcnqdyrzpqdoqnp.supabase.co/functions/v1/stripe-event-alert',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-internal-job-token', public.internal_job_token()),
    body := jsonb_build_object('id', NEW.id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;