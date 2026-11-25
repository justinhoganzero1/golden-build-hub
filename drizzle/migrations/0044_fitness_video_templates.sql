CREATE TABLE public.fitness_video_templates (
 exercise_key text PRIMARY KEY,
 video_id text NOT NULL,
 title text NOT NULL,
 channel_title text NOT NULL,
 description text NOT NULL DEFAULT '',
 commentary jsonb NOT NULL DEFAULT '[]'::jsonb,
 fetched_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);
GRANT SELECT ON public.fitness_video_templates TO authenticated;
GRANT ALL ON public.fitness_video_templates TO service_role;
ALTER TABLE public.fitness_video_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read public exercise templates" ON public.fitness_video_templates FOR SELECT TO authenticated USING (true);