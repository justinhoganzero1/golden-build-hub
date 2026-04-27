-- Brand kit: one row per user
CREATE TABLE public.user_brand_kits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  brand_name TEXT,
  tagline TEXT,
  logo_url TEXT,
  custom_label TEXT,
  custom_link TEXT,
  primary_color TEXT DEFAULT '#FFD700',
  watermarks JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own brand kit" ON public.user_brand_kits
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_owner());
CREATE POLICY "Users insert own brand kit" ON public.user_brand_kits
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own brand kit" ON public.user_brand_kits
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own brand kit" ON public.user_brand_kits
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_brand_kits_updated
BEFORE UPDATE ON public.user_brand_kits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Photography templates
CREATE TABLE public.photography_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  filter TEXT DEFAULT 'None',
  mode TEXT NOT NULL DEFAULT 'generate',
  social_platform TEXT,
  watermark_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.photography_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own templates" ON public.photography_templates
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_owner());
CREATE POLICY "Users insert own templates" ON public.photography_templates
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own templates" ON public.photography_templates
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own templates" ON public.photography_templates
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_photo_templates_updated
BEFORE UPDATE ON public.photography_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_photo_templates_user ON public.photography_templates(user_id, created_at DESC);

-- Quota helper: returns count + unlocked flag
CREATE OR REPLACE FUNCTION public.photo_template_quota(_user_id UUID)
RETURNS TABLE(template_count INTEGER, unlocked BOOLEAN, free_limit INTEGER)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_unlocked BOOLEAN;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.photography_templates WHERE user_id = _user_id;

  SELECT EXISTS(
    SELECT 1 FROM public.app_unlocks
    WHERE user_id = _user_id AND app_key = 'photo_templates'
  ) OR public.has_role(_user_id, 'admin') INTO v_unlocked;

  RETURN QUERY SELECT v_count, v_unlocked, 5;
END;
$$;

-- Public storage bucket for logos + watermarked exports
INSERT INTO storage.buckets (id, name, public)
VALUES ('photography-assets', 'photography-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read photography assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'photography-assets');

CREATE POLICY "Users upload own photography assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photography-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own photography assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'photography-assets' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own photography assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photography-assets' AND auth.uid()::text = (storage.foldername(name))[1]);