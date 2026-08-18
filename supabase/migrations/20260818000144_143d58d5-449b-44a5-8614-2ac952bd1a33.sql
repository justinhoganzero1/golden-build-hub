DROP POLICY IF EXISTS "Anyone can insert install events" ON public.install_events;
CREATE POLICY "Anyone can insert install events"
ON public.install_events
FOR INSERT
WITH CHECK (
  event_type = ANY (ARRAY['click','download_start','guide_open','step_complete','install_success','install_failure','installed'])
  AND platform = ANY (ARRAY['android','ios','desktop','unknown'])
  AND (user_id IS NULL OR user_id = auth.uid())
);