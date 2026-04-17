-- Install analytics events
CREATE TABLE public.install_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('click', 'installed')),
  platform TEXT NOT NULL CHECK (platform IN ('android', 'ios', 'desktop', 'unknown')),
  user_id UUID NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_install_events_created_at ON public.install_events (created_at DESC);
CREATE INDEX idx_install_events_event_type ON public.install_events (event_type);
CREATE INDEX idx_install_events_platform ON public.install_events (platform);

ALTER TABLE public.install_events ENABLE ROW LEVEL SECURITY;

-- Anyone (guests + logged-in) can record an install event
CREATE POLICY "Anyone can insert install events"
ON public.install_events
FOR INSERT
TO public
WITH CHECK (
  event_type IN ('click', 'installed')
  AND platform IN ('android', 'ios', 'desktop', 'unknown')
);

-- Only the owner/admin can view all events
CREATE POLICY "Owner can view all install events"
ON public.install_events
FOR SELECT
TO authenticated
USING (public.is_owner());

-- Only the owner/admin can delete events (cleanup)
CREATE POLICY "Owner can delete install events"
ON public.install_events
FOR DELETE
TO authenticated
USING (public.is_owner());