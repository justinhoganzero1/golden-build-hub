ALTER TABLE public.movie_render_jobs
  ADD COLUMN IF NOT EXISTS provider_state jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.movie_render_jobs.provider_state IS
  'Resume slot for cron-driven rendering: stores in-flight provider task/render ids (Runway, Replicate, Shotstack, Veo) so a re-queued tick polls the existing job instead of submitting — and paying for — a new one.';