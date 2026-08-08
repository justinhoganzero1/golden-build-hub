CREATE TABLE public.ai_discovery_events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type text NOT NULL,
  path text,
  bot text,
  engine text,
  referrer text,
  query_hint text,
  user_agent text,
  user_id uuid,
  amount_cents integer,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT INSERT ON public.ai_discovery_events TO anon;
GRANT SELECT, INSERT ON public.ai_discovery_events TO authenticated;
GRANT ALL ON public.ai_discovery_events TO service_role;

ALTER TABLE public.ai_discovery_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record discovery events"
  ON public.ai_discovery_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Admins can read discovery events"
  ON public.ai_discovery_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_ai_discovery_events_created_at ON public.ai_discovery_events (created_at DESC);
CREATE INDEX idx_ai_discovery_events_type ON public.ai_discovery_events (event_type, created_at DESC);