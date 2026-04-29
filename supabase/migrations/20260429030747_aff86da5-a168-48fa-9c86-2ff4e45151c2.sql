-- Affiliate click tracking
CREATE TABLE IF NOT EXISTS public.affiliate_clicks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner text NOT NULL,
  placement text NOT NULL,
  user_id uuid,
  clicked_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_partner ON public.affiliate_clicks(partner);
CREATE INDEX IF NOT EXISTS idx_affiliate_clicks_clicked_at ON public.affiliate_clicks(clicked_at DESC);

ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a click (anonymous tracking ok)
CREATE POLICY "anyone can record affiliate clicks"
  ON public.affiliate_clicks
  FOR INSERT
  WITH CHECK (true);

-- Only admin can read
CREATE POLICY "admin can read affiliate clicks"
  ON public.affiliate_clicks
  FOR SELECT
  USING (public.is_owner());