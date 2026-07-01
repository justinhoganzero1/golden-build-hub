
CREATE TABLE public.immersive_movie_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.immersive_movie_projects TO authenticated;
GRANT ALL ON public.immersive_movie_projects TO service_role;
ALTER TABLE public.immersive_movie_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own immersive projects"
  ON public.immersive_movie_projects FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_immersive_movie_projects_user ON public.immersive_movie_projects(user_id, updated_at DESC);

-- Storage policies for the immersive-movies bucket (bucket created via tool call)
CREATE POLICY "Users can read own immersive media"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'immersive-movies' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can upload own immersive media"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'immersive-movies' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users can delete own immersive media"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'immersive-movies' AND (storage.foldername(name))[1] = auth.uid()::text);
