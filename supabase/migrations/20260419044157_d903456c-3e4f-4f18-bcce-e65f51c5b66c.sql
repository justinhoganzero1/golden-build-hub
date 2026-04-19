-- 1. Create the movies storage bucket (public read so YouTube can fetch finals)
INSERT INTO storage.buckets (id, name, public)
VALUES ('movies', 'movies', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for the movies bucket
CREATE POLICY "Movies are publicly readable"
ON storage.objects FOR SELECT
USING (bucket_id = 'movies');

CREATE POLICY "Users upload to own movie folder"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'movies'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users update own movie files"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'movies'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users delete own movie files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'movies'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Service role manages movie files"
ON storage.objects FOR ALL
USING (bucket_id = 'movies' AND public.is_owner())
WITH CHECK (bucket_id = 'movies' AND public.is_owner());

-- 2. Realtime: enable replica identity full + add to publication
ALTER TABLE public.movie_projects REPLICA IDENTITY FULL;
ALTER TABLE public.movie_scenes REPLICA IDENTITY FULL;
ALTER TABLE public.movie_render_jobs REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.movie_projects;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.movie_scenes;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.movie_render_jobs;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

-- 3. Retry helper for failure recovery UI
CREATE OR REPLACE FUNCTION public.retry_failed_scene(_scene_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_scene RECORD;
BEGIN
  SELECT * INTO v_scene FROM public.movie_scenes WHERE id = _scene_id;
  IF v_scene IS NULL THEN RETURN false; END IF;
  IF v_scene.user_id <> auth.uid() AND NOT public.is_owner() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.movie_scenes
  SET status = 'pending',
      last_error = NULL,
      retry_count = COALESCE(retry_count, 0) + 1,
      started_at = NULL,
      completed_at = NULL,
      updated_at = now()
  WHERE id = _scene_id;

  INSERT INTO public.movie_render_jobs (project_id, scene_id, user_id, job_type, priority)
  VALUES (v_scene.project_id, _scene_id, v_scene.user_id, 'video', 50);

  UPDATE public.movie_projects
  SET failed_scenes = GREATEST(0, COALESCE(failed_scenes, 0) - 1),
      status = CASE WHEN status = 'failed' THEN 'rendering' ELSE status END,
      last_error = NULL,
      updated_at = now()
  WHERE id = v_scene.project_id;

  RETURN true;
END;
$$;