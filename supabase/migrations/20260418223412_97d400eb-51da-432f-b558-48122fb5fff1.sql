
-- Site content (text + image slots)
CREATE TABLE public.site_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  page TEXT NOT NULL,
  slot TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','image','url','number','boolean')),
  value TEXT NOT NULL DEFAULT '',
  notes TEXT,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(page, slot)
);
CREATE INDEX idx_site_content_page ON public.site_content(page);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site content"
  ON public.site_content FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Owner can insert site content"
  ON public.site_content FOR INSERT
  TO authenticated
  WITH CHECK (public.is_owner());

CREATE POLICY "Owner can update site content"
  ON public.site_content FOR UPDATE
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

CREATE POLICY "Owner can delete site content"
  ON public.site_content FOR DELETE
  TO authenticated
  USING (public.is_owner());

CREATE TRIGGER trg_site_content_updated_at
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Site-wide announcement banner
CREATE TABLE public.site_announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message TEXT NOT NULL,
  cta_label TEXT,
  cta_url TEXT,
  active BOOLEAN NOT NULL DEFAULT false,
  style TEXT NOT NULL DEFAULT 'info' CHECK (style IN ('info','warning','success','promo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read announcements"
  ON public.site_announcements FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Owner manages announcements"
  ON public.site_announcements FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

CREATE TRIGGER trg_site_announcements_updated_at
  BEFORE UPDATE ON public.site_announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for editable site images
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public can view site assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'site-assets');

CREATE POLICY "Owner can upload site assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'site-assets' AND public.is_owner());

CREATE POLICY "Owner can update site assets"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'site-assets' AND public.is_owner());

CREATE POLICY "Owner can delete site assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'site-assets' AND public.is_owner());
