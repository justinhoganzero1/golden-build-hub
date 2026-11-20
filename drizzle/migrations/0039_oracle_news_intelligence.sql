CREATE TABLE public.news_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'rss' CHECK (kind IN ('rss','youtube_rss','nasa_video')),
  url text NOT NULL UNIQUE,
  region text NOT NULL DEFAULT 'intl' CHECK (region IN ('au','intl')),
  category text NOT NULL DEFAULT 'general',
  publisher_type text NOT NULL DEFAULT 'publisher' CHECK (publisher_type IN ('publisher','official')),
  enabled boolean NOT NULL DEFAULT true,
  last_scan_at timestamptz,
  last_ok_at timestamptz,
  last_status text NOT NULL DEFAULT 'never',
  last_error text,
  items_last integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_sources TO authenticated;
GRANT ALL ON public.news_sources TO service_role;
ALTER TABLE public.news_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages news_sources" ON public.news_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.news_stories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cluster_key text NOT NULL UNIQUE,
  headline text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  region text NOT NULL DEFAULT 'intl',
  verification text NOT NULL DEFAULT 'unverified',
  source_count integer NOT NULL DEFAULT 0,
  official_count integer NOT NULL DEFAULT 0,
  importance numeric NOT NULL DEFAULT 0,
  summary text,
  conflicts text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','selected','used','dismissed')),
  is_breaking boolean NOT NULL DEFAULT false,
  update_count integer NOT NULL DEFAULT 0,
  analysed_at timestamptz,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_updated timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_stories TO authenticated;
GRANT ALL ON public.news_stories TO service_role;
ALTER TABLE public.news_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages news_stories" ON public.news_stories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.news_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid NOT NULL REFERENCES public.news_sources(id) ON DELETE CASCADE,
  story_id uuid REFERENCES public.news_stories(id) ON DELETE SET NULL,
  guid_hash text NOT NULL UNIQUE,
  title text NOT NULL,
  summary text,
  url text NOT NULL,
  published_at timestamptz,
  extract text,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX news_items_story_idx ON public.news_items(story_id);
CREATE INDEX news_items_fetched_idx ON public.news_items(fetched_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_items TO authenticated;
GRANT ALL ON public.news_items TO service_role;
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages news_items" ON public.news_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.news_footage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid REFERENCES public.news_stories(id) ON DELETE CASCADE,
  source_kind text NOT NULL,
  url text NOT NULL,
  embed_url text,
  file_path text,
  thumbnail_url text,
  title text NOT NULL,
  creator text,
  copyright_owner text,
  licence text,
  commercial_use boolean NOT NULL DEFAULT false,
  editing_allowed boolean NOT NULL DEFAULT false,
  attribution text,
  permission_expiry date,
  rating text NOT NULL DEFAULT 'red' CHECK (rating IN ('green','amber','red')),
  approval_status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, url)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_footage TO authenticated;
GRANT ALL ON public.news_footage TO service_role;
ALTER TABLE public.news_footage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages news_footage" ON public.news_footage FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.news_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edition_date date NOT NULL,
  kind text NOT NULL DEFAULT 'daily' CHECK (kind IN ('daily','breaking','manual')),
  title text NOT NULL,
  status text NOT NULL DEFAULT 'scripted' CHECK (status IN ('scripted','awaiting_approval','approved','produced','published','failed')),
  script text NOT NULL DEFAULT '',
  story_ids uuid[] NOT NULL DEFAULT '{}',
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  footage_ids uuid[] NOT NULL DEFAULT '{}',
  duration_seconds integer,
  video_path text,
  library_id text,
  thumbnail_url text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  produced_at timestamptz,
  published_at timestamptz
);
CREATE UNIQUE INDEX news_broadcasts_daily_uniq ON public.news_broadcasts(edition_date) WHERE kind = 'daily';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_broadcasts TO authenticated;
GRANT ALL ON public.news_broadcasts TO service_role;
ALTER TABLE public.news_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages news_broadcasts" ON public.news_broadcasts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Members watch published news" ON public.news_broadcasts FOR SELECT TO authenticated
  USING (status = 'published');

CREATE TABLE public.news_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode text NOT NULL DEFAULT 'approval' CHECK (mode IN ('automatic','approval','manual')),
  categories text[] NOT NULL DEFAULT ARRAY['general','world','australia','science','technology','health'],
  story_count integer NOT NULL DEFAULT 5 CHECK (story_count BETWEEN 1 AND 12),
  duration_minutes integer NOT NULL DEFAULT 5 CHECK (duration_minutes BETWEEN 1 AND 20),
  au_share integer NOT NULL DEFAULT 60 CHECK (au_share BETWEEN 0 AND 100),
  breaking_priority boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'Australia/Brisbane',
  lock_until timestamptz,
  last_daily_steps jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.news_settings TO authenticated;
GRANT ALL ON public.news_settings TO service_role;
ALTER TABLE public.news_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages news_settings" ON public.news_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
INSERT INTO public.news_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.news_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step text NOT NULL,
  trigger text NOT NULL DEFAULT 'owner',
  status text NOT NULL DEFAULT 'running',
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX news_runs_started_idx ON public.news_runs(started_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_runs TO authenticated;
GRANT ALL ON public.news_runs TO service_role;
ALTER TABLE public.news_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages news_runs" ON public.news_runs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.news_sources (name, kind, url, region, category, publisher_type) VALUES
 ('ABC News – Top stories','rss','https://www.abc.net.au/news/feed/51120/rss.xml','au','australia','publisher'),
 ('ABC News – Just in','rss','https://www.abc.net.au/news/feed/2942460/rss.xml','au','australia','publisher'),
 ('SBS News – Latest','rss','https://www.sbs.com.au/news/topic/latest/feed','au','australia','publisher'),
 ('Guardian Australia','rss','https://www.theguardian.com/australia-news/rss','au','australia','publisher'),
 ('BBC News – World','rss','https://feeds.bbci.co.uk/news/world/rss.xml','intl','world','publisher'),
 ('NASA – News releases','rss','https://www.nasa.gov/news-release/feed/','intl','science','official'),
 ('UN News','rss','https://news.un.org/feed/subscribe/en/news/all/rss.xml','intl','world','official'),
 ('World Health Organization','rss','https://www.who.int/rss-feeds/news-english.xml','intl','health','official'),
 ('UK Government newsroom','rss','https://www.gov.uk/search/news-and-communications.atom','intl','world','official'),
 ('Australian Dept of Foreign Affairs','rss','https://www.dfat.gov.au/rss.xml','au','australia','official'),
 ('Australian Dept of Health','rss','https://www.health.gov.au/news/rss.xml','au','health','official'),
 ('ScienceDaily – Top science','rss','https://www.sciencedaily.com/rss/top/science.xml','intl','science','publisher'),
 ('ABC News (Australia) – YouTube','youtube_rss','https://www.youtube.com/feeds/videos.xml?channel_id=UCVgO39Bk5sMo66-6o6Spn6Q','au','video','publisher'),
 ('BBC News – YouTube','youtube_rss','https://www.youtube.com/feeds/videos.xml?channel_id=UC16niRr50-MSBwiO3YDb3RA','intl','video','publisher'),
 ('NASA – YouTube','youtube_rss','https://www.youtube.com/feeds/videos.xml?channel_id=UCLA_DiR1FfKNvjuUpBHmylQ','intl','video','official'),
 ('NASA Image and Video Library','nasa_video','https://images.nasa.gov','intl','video','official')
ON CONFLICT (url) DO NOTHING;

CREATE POLICY "Owner manages news-footage files" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'news-footage' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'news-footage' AND public.has_role(auth.uid(),'admin'));

SELECT cron.schedule('news-controller-hourly', '3 * * * *',
  $$SELECT net.http_post(url := 'https://tpkpfkcnqdyrzpqdoqnp.supabase.co/functions/v1/news-controller', headers := jsonb_build_object('Content-Type','application/json','x-internal-job-token', public.internal_job_token()), body := '{"action":"tick"}'::jsonb);$$);