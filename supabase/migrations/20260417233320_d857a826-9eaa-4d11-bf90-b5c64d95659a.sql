CREATE TABLE public.page_views (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page text NOT NULL DEFAULT 'landing',
  user_agent text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.page_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a page view"
  ON public.page_views
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (length(trim(page)) > 0);

CREATE POLICY "Anyone can read page views"
  ON public.page_views
  FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX idx_page_views_page ON public.page_views(page);
CREATE INDEX idx_page_views_created_at ON public.page_views(created_at DESC);