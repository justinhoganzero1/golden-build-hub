
SELECT public._reschedule_cron(
  'voice-receptionist-drip-tick',
  '*/5 * * * *',
  $cmd$
    SELECT net.http_post(
      url := 'https://tpkpfkcnqdyrzpqdoqnp.supabase.co/functions/v1/voice-receptionist-drip-tick',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRwa3Bma2NucWR5cnpwcWRvcW5wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NDIyMjAsImV4cCI6MjA5MTIxODIyMH0.gq7OXot4gtcJpmDin3fCLz7fxrQDsfgXQM5ym2ZB9Is'),
      body := '{}'::jsonb
    );
  $cmd$
);
