CREATE TABLE public.movie_story_handoffs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL DEFAULT auth.uid(),
  title TEXT NOT NULL DEFAULT 'Untitled story',
  source TEXT NOT NULL DEFAULT 'story_writer',
  brief JSONB NOT NULL DEFAULT '{}'::jsonb,
  opened BOOLEAN NOT NULL DEFAULT false,
  opened_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.movie_story_handoffs TO authenticated;
GRANT ALL ON public.movie_story_handoffs TO service_role;

ALTER TABLE public.movie_story_handoffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners read their movie handoffs"
  ON public.movie_story_handoffs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners create their movie handoffs"
  ON public.movie_story_handoffs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners update their movie handoffs"
  ON public.movie_story_handoffs FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners delete their movie handoffs"
  ON public.movie_story_handoffs FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE INDEX movie_story_handoffs_user_created_idx
  ON public.movie_story_handoffs (user_id, created_at DESC);

CREATE TRIGGER update_movie_story_handoffs_updated_at
  BEFORE UPDATE ON public.movie_story_handoffs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();