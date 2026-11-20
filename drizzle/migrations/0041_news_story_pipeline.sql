ALTER TABLE public.news_stories
  ADD COLUMN IF NOT EXISTS production_status text NOT NULL DEFAULT 'discovered',
  ADD COLUMN IF NOT EXISTS production_error text,
  ADD COLUMN IF NOT EXISTS production_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS production_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS script_sections jsonb,
  ADD COLUMN IF NOT EXISTS content_checked jsonb,
  ADD COLUMN IF NOT EXISTS broadcast_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_broadcast_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_at timestamptz;

ALTER TABLE public.news_stories ADD CONSTRAINT news_stories_production_status_check CHECK (production_status IN
  ('discovered','content_retrieved','analysing','script_ready','searching_footage','footage_verified','ready_to_broadcast','presenter_speaking','broadcast_complete','failed','expired'));

CREATE INDEX IF NOT EXISTS news_stories_production_idx ON public.news_stories (production_status, importance DESC);
CREATE INDEX IF NOT EXISTS news_stories_public_idx ON public.news_stories (public_at DESC) WHERE public_at IS NOT NULL;

ALTER TABLE public.news_footage
  ADD COLUMN IF NOT EXISTS section text,
  ADD COLUMN IF NOT EXISTS media_type text NOT NULL DEFAULT 'video',
  ADD COLUMN IF NOT EXISTS media_url text,
  ADD COLUMN IF NOT EXISTS source_org text,
  ADD COLUMN IF NOT EXISTS playback_status text NOT NULL DEFAULT 'unchecked';

ALTER TABLE public.news_footage ADD CONSTRAINT news_footage_media_type_check CHECK (media_type IN ('video','image','graphic'));
ALTER TABLE public.news_footage ADD CONSTRAINT news_footage_playback_status_check CHECK (playback_status IN ('unchecked','ok','failed'));

ALTER TABLE public.news_settings
  ADD COLUMN IF NOT EXISTS auto_pipeline boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS pipeline_daily_cap integer NOT NULL DEFAULT 10;
ALTER TABLE public.news_settings ADD CONSTRAINT news_settings_pipeline_cap_check CHECK (pipeline_daily_cap BETWEEN 0 AND 40);

-- Stories older than the 36-hour news window were never going to be produced: mark them honestly.
UPDATE public.news_stories SET production_status = 'expired', production_updated_at = now()
  WHERE last_updated < now() - interval '36 hours';
UPDATE public.news_stories SET production_status = 'expired', production_updated_at = now()
  WHERE status = 'dismissed';