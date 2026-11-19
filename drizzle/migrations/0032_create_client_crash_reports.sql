CREATE TABLE public.client_crash_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  page text NOT NULL CHECK (char_length(page) <= 120),
  path text CHECK (char_length(path) <= 300),
  message text NOT NULL CHECK (char_length(message) <= 1000),
  stack text CHECK (char_length(stack) <= 4000),
  user_agent text CHECK (char_length(user_agent) <= 400),
  app_kind text CHECK (app_kind IN ('native','installed','browser')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.client_crash_reports TO anon, authenticated;
GRANT SELECT, DELETE ON public.client_crash_reports TO authenticated;
GRANT ALL ON public.client_crash_reports TO service_role;
ALTER TABLE public.client_crash_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone records their own crash" ON public.client_crash_reports
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());
CREATE POLICY "Admins read crash reports" ON public.client_crash_reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete crash reports" ON public.client_crash_reports
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX client_crash_reports_created_idx ON public.client_crash_reports (created_at DESC);