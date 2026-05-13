
CREATE TABLE IF NOT EXISTS public.stripe_event_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,                -- 'webhook' | 'checkout' | 'portal' | 'connect' | 'health'
  event_type TEXT,                     -- e.g. 'checkout.session.completed'
  status TEXT NOT NULL DEFAULT 'ok',   -- 'ok' | 'error' | 'signature_failed' | 'ignored'
  stripe_event_id TEXT,
  stripe_session_id TEXT,
  stripe_customer_id TEXT,
  user_id UUID,
  amount_cents INTEGER,
  message TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stripe_event_log_status_idx ON public.stripe_event_log (status, created_at DESC);
CREATE INDEX IF NOT EXISTS stripe_event_log_event_idx ON public.stripe_event_log (event_type, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS stripe_event_log_event_id_uniq ON public.stripe_event_log (stripe_event_id) WHERE stripe_event_id IS NOT NULL;

ALTER TABLE public.stripe_event_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner reads stripe events"
  ON public.stripe_event_log FOR SELECT
  USING (public.is_owner());

CREATE POLICY "service role writes stripe events"
  ON public.stripe_event_log FOR INSERT
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.stripe_event_summary(_hours integer DEFAULT 24)
RETURNS TABLE(
  source TEXT,
  status TEXT,
  count BIGINT,
  last_at TIMESTAMPTZ
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT source, status, COUNT(*)::bigint, MAX(created_at)
  FROM public.stripe_event_log
  WHERE created_at >= now() - make_interval(hours => GREATEST(1, _hours))
    AND public.is_owner()
  GROUP BY source, status
  ORDER BY status DESC, count DESC;
$$;
