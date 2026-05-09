
CREATE TABLE IF NOT EXISTS public.featured_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid,
  source_kind text NOT NULL DEFAULT 'user_media',
  image_url text NOT NULL,
  title text,
  creator_name text,
  active boolean NOT NULL DEFAULT true,
  featured_until timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.featured_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active featured photos"
ON public.featured_photos FOR SELECT
USING (active = true);

CREATE POLICY "Admins can view all featured photos"
ON public.featured_photos FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert featured photos"
ON public.featured_photos FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update featured photos"
ON public.featured_photos FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete featured photos"
ON public.featured_photos FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_featured_photos_updated
BEFORE UPDATE ON public.featured_photos
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_featured_photos_active ON public.featured_photos(active, created_at DESC);
