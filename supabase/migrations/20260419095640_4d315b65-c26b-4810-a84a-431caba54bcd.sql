CREATE OR REPLACE FUNCTION public.claim_next_living_gif(_worker_id text)
 RETURNS TABLE(gif_id uuid, user_id uuid, source_image_url text, prompt text, pipeline_stage text, runway_task_id text, replicate_prediction_id text, attempts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_gif_id uuid;
BEGIN
  SELECT g.id INTO v_gif_id
  FROM public.living_gifs g
  WHERE g.status IN ('queued','running','upscaling','generating')
    AND g.attempts < g.max_attempts
    AND (g.locked_at IS NULL OR g.locked_at < now() - interval '3 minutes')
  ORDER BY g.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_gif_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.living_gifs g
  SET status = 'running',
      locked_at = now(),
      locked_by = _worker_id,
      attempts = g.attempts + 1,
      last_progress_at = COALESCE(g.last_progress_at, now()),
      updated_at = now()
  WHERE g.id = v_gif_id;

  RETURN QUERY
  SELECT g.id, g.user_id, g.source_image_url, g.prompt, g.pipeline_stage,
         g.runway_task_id, g.replicate_prediction_id, g.attempts
  FROM public.living_gifs g
  WHERE g.id = v_gif_id;
END;
$function$;