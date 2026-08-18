ALTER TABLE public.install_events DROP CONSTRAINT IF EXISTS install_events_event_type_check;
ALTER TABLE public.install_events ADD CONSTRAINT install_events_event_type_check
  CHECK (event_type = ANY (ARRAY['click','download_start','guide_open','step_complete','install_success','install_failure','installed']));