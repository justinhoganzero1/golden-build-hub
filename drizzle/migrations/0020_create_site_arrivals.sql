CREATE TABLE public.site_arrivals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_path text NOT NULL CHECK (char_length(landing_path) BETWEEN 1 AND 200),
  source text NOT NULL DEFAULT 'direct' CHECK (char_length(source) <= 100),
  medium text CHECK (medium IS NULL OR char_length(medium) <= 100),
  campaign text CHECK (campaign IS NULL OR char_length(campaign) <= 100),
  referrer text CHECK (referrer IS NULL OR char_length(referrer) <= 500),
  user_agent text CHECK (user_agent IS NULL OR char_length(user_agent) <= 200),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.site_arrivals TO anon;
GRANT SELECT, INSERT ON public.site_arrivals TO authenticated;
GRANT ALL ON public.site_arrivals TO service_role;

ALTER TABLE public.site_arrivals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record an anonymous arrival"
  ON public.site_arrivals FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Owner can read arrivals"
  ON public.site_arrivals FOR SELECT
  TO authenticated
  USING (public.is_owner());

CREATE INDEX idx_site_arrivals_created_at ON public.site_arrivals (created_at DESC);
CREATE INDEX idx_site_arrivals_landing_path ON public.site_arrivals (landing_path);