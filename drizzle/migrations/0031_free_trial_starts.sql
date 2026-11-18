CREATE TABLE public.free_trial_starts (
  user_id uuid PRIMARY KEY,
  trial_ends_at timestamptz NOT NULL,
  blocked boolean NOT NULL DEFAULT false,
  blocked_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.free_trial_starts TO service_role;
ALTER TABLE public.free_trial_starts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner can view free trial starts" ON public.free_trial_starts
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.free_trial_starts TO authenticated;