-- Schedule movie pipeline cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Helper to safely (re)schedule a cron job
CREATE OR REPLACE FUNCTION public._reschedule_cron(_name text, _schedule text, _command text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, cron
AS $$
DECLARE
  _existing_id bigint;
BEGIN
  SELECT jobid INTO _existing_id FROM cron.job WHERE jobname = _name;
  IF _existing_id IS NOT NULL THEN
    PERFORM cron.unschedule(_existing_id);
  END IF;
  PERFORM cron.schedule(_name, _schedule, _command);
END;
$$;

-- Movie render worker — every minute
SELECT public._reschedule_cron(
  'movie-render-worker-tick',
  '* * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://tpkpfkcnqdyrzpqdoqnp.supabase.co/functions/v1/movie-render-worker',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwa3Bma2NucWR5cnpwcWRvcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDIyMjAsImV4cCI6MjA5MTIxODIyMH0.gq7OXot4gtcJpmDin3fCLz7fxrQDsfgXQM5ym2ZB9Is'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cmd$
);

-- Movie failure notifier — every hour
SELECT public._reschedule_cron(
  'movie-failure-notify-hourly',
  '0 * * * *',
  $cmd$
  SELECT net.http_post(
    url := 'https://tpkpfkcnqdyrzpqdoqnp.supabase.co/functions/v1/movie-failure-notify',
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwa3Bma2NucWR5cnpwcWRvcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDIyMjAsImV4cCI6MjA5MTIxODIyMH0.gq7OXot4gtcJpmDin3fCLz7fxrQDsfgXQM5ym2ZB9Is'
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $cmd$
);