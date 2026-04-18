-- Site edits proposed by admin via Oracle, then published
CREATE TABLE public.site_edits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  page TEXT NOT NULL,
  change_type TEXT NOT NULL DEFAULT 'copy',
  before_text TEXT,
  after_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'proposed',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.site_edits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin can manage site edits"
ON public.site_edits FOR ALL
TO authenticated
USING (public.is_owner())
WITH CHECK (public.is_owner());

CREATE TRIGGER update_site_edits_updated_at
BEFORE UPDATE ON public.site_edits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Lead magnet conversions tracking (free tools used by anonymous visitors)
CREATE TABLE public.lead_magnet_uses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool TEXT NOT NULL,
  prompt TEXT,
  result_preview TEXT,
  visitor_id TEXT,
  converted_to_signup BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_magnet_uses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a lead magnet use"
ON public.lead_magnet_uses FOR INSERT
TO anon, authenticated
WITH CHECK (length(trim(tool)) > 0);

CREATE POLICY "Owner can view lead magnet uses"
ON public.lead_magnet_uses FOR SELECT
TO authenticated
USING (public.is_owner());