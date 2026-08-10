DROP POLICY "Anyone can record discovery events" ON public.ai_discovery_events;
CREATE POLICY "Anyone can record discovery events"
ON public.ai_discovery_events
FOR INSERT
WITH CHECK (user_id IS NULL OR user_id = auth.uid());

DROP POLICY "Anyone can insert install events" ON public.install_events;
CREATE POLICY "Anyone can insert install events"
ON public.install_events
FOR INSERT
WITH CHECK (
  (event_type = ANY (ARRAY['click'::text, 'installed'::text]))
  AND (platform = ANY (ARRAY['android'::text, 'ios'::text, 'desktop'::text, 'unknown'::text]))
  AND (user_id IS NULL OR user_id = auth.uid())
);