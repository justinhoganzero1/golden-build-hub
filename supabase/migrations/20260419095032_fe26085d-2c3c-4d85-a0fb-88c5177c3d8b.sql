-- 1. Queue / worker fields on living_gifs
ALTER TABLE public.living_gifs
  ADD COLUMN IF NOT EXISTS pipeline_stage text,
  ADD COLUMN IF NOT EXISTS runway_task_id text,
  ADD COLUMN IF NOT EXISTS replicate_prediction_id text,
  ADD COLUMN IF NOT EXISTS attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS locked_at timestamptz,
  ADD COLUMN IF NOT EXISTS locked_by text,
  ADD COLUMN IF NOT EXISTS last_progress_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_living_gifs_status_locked
  ON public.living_gifs (status, locked_at);

-- 2. Worker claim function — picks the oldest queued GIF & locks it
CREATE OR REPLACE FUNCTION public.claim_next_living_gif(_worker_id text)
RETURNS TABLE (
  gif_id uuid,
  user_id uuid,
  source_image_url text,
  prompt text,
  pipeline_stage text,
  runway_task_id text,
  replicate_prediction_id text,
  attempts integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_gif_id uuid;
BEGIN
  SELECT id INTO v_gif_id
  FROM public.living_gifs
  WHERE status IN ('queued','running','upscaling','generating')
    AND attempts < max_attempts
    AND (locked_at IS NULL OR locked_at < now() - interval '3 minutes')
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_gif_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.living_gifs
  SET status = 'running',
      locked_at = now(),
      locked_by = _worker_id,
      attempts = attempts + 1,
      last_progress_at = COALESCE(last_progress_at, now()),
      updated_at = now()
  WHERE id = v_gif_id;

  RETURN QUERY
  SELECT g.id, g.user_id, g.source_image_url, g.prompt, g.pipeline_stage,
         g.runway_task_id, g.replicate_prediction_id, g.attempts
  FROM public.living_gifs g
  WHERE g.id = v_gif_id;
END;
$$;

-- 3. Reset the one currently-stuck row so the new worker can finish it.
UPDATE public.living_gifs
SET status = 'queued',
    pipeline_stage = NULL,
    runway_task_id = NULL,
    replicate_prediction_id = NULL,
    attempts = 0,
    locked_at = NULL,
    locked_by = NULL,
    last_progress_at = NULL,
    error_message = NULL,
    updated_at = now()
WHERE status = 'generating'
  AND gif_url IS NULL;