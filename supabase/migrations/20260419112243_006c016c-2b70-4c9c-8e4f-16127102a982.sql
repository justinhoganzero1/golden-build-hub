CREATE OR REPLACE FUNCTION public.claim_next_render_job(_worker_id text)
 RETURNS TABLE(job_id uuid, project_id uuid, scene_id uuid, user_id uuid, job_type text, payload jsonb, attempts integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_job_id UUID;
BEGIN
  SELECT j.id INTO v_job_id
  FROM public.movie_render_jobs j
  WHERE j.status = 'queued'
    AND j.scheduled_for <= now()
    AND j.attempts < j.max_attempts
  ORDER BY j.priority ASC, j.scheduled_for ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.movie_render_jobs
  SET status = 'running',
      locked_at = now(),
      locked_by = _worker_id,
      started_at = COALESCE(started_at, now()),
      attempts = movie_render_jobs.attempts + 1,
      updated_at = now()
  WHERE id = v_job_id;

  RETURN QUERY
  SELECT j.id, j.project_id, j.scene_id, j.user_id, j.job_type, j.payload, j.attempts
  FROM public.movie_render_jobs j
  WHERE j.id = v_job_id;
END;
$function$;