
-- Living GIFs: paid 20s 8K animated avatar GIFs, banked permanently per user
CREATE TABLE public.living_gifs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  source_avatar_id UUID REFERENCES public.user_avatars(id) ON DELETE SET NULL,
  source_image_url TEXT NOT NULL,
  prompt TEXT NOT NULL,
  title TEXT,
  gif_url TEXT,
  preview_mp4_url TEXT,
  thumbnail_url TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 20,
  resolution TEXT NOT NULL DEFAULT '8k',
  status TEXT NOT NULL DEFAULT 'pending_payment',
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  amount_paid_cents INTEGER NOT NULL DEFAULT 400,
  currency TEXT NOT NULL DEFAULT 'usd',
  is_active_oracle BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_living_gifs_user ON public.living_gifs(user_id, created_at DESC);
CREATE INDEX idx_living_gifs_active ON public.living_gifs(user_id) WHERE is_active_oracle = true;
CREATE INDEX idx_living_gifs_session ON public.living_gifs(stripe_session_id);

ALTER TABLE public.living_gifs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own living gifs" ON public.living_gifs
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_owner());

CREATE POLICY "Users create own living gifs" ON public.living_gifs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own living gifs" ON public.living_gifs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own living gifs" ON public.living_gifs
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.is_owner());

CREATE TRIGGER trg_living_gifs_updated_at
  BEFORE UPDATE ON public.living_gifs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure only one active Oracle GIF per user
CREATE OR REPLACE FUNCTION public.enforce_single_active_living_gif()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.is_active_oracle = true THEN
    UPDATE public.living_gifs
    SET is_active_oracle = false, updated_at = now()
    WHERE user_id = NEW.user_id AND id <> NEW.id AND is_active_oracle = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_living_gifs_single_active
  AFTER INSERT OR UPDATE OF is_active_oracle ON public.living_gifs
  FOR EACH ROW WHEN (NEW.is_active_oracle = true)
  EXECUTE FUNCTION public.enforce_single_active_living_gif();

-- Storage bucket for the rendered GIFs
INSERT INTO storage.buckets (id, name, public)
VALUES ('living-gifs', 'living-gifs', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Living GIFs are publicly readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'living-gifs');

CREATE POLICY "Users upload own living gif files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'living-gifs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users update own living gif files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'living-gifs' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own living gif files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'living-gifs' AND auth.uid()::text = (storage.foldername(name))[1]);
