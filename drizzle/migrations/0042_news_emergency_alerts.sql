CREATE TABLE public.news_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('nuclear_launch')),
  headline text NOT NULL,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  confirmed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '12 hours'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news_alerts TO authenticated;
GRANT ALL ON public.news_alerts TO service_role;
ALTER TABLE public.news_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in members read active alerts" ON public.news_alerts
  FOR SELECT TO authenticated USING (expires_at > now());
CREATE INDEX news_alerts_active_idx ON public.news_alerts (expires_at DESC);