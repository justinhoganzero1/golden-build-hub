-- 1. user_style_profile: rolling per-user voice fingerprint
CREATE TABLE public.user_style_profile (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  sample_count integer NOT NULL DEFAULT 0,
  avg_sentence_length numeric,
  avg_word_length numeric,
  formality_score numeric,
  warmth_score numeric,
  emoji_rate numeric,
  exclamation_rate numeric,
  question_rate numeric,
  voice_summary text,
  common_phrases text[] DEFAULT '{}',
  signature_quirks text[] DEFAULT '{}',
  preferred_greetings text[] DEFAULT '{}',
  preferred_signoffs text[] DEFAULT '{}',
  emotional_register text,
  last_updated timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_style_profile TO authenticated;
GRANT ALL ON public.user_style_profile TO service_role;

ALTER TABLE public.user_style_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own style profile"
  ON public.user_style_profile FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own style profile"
  ON public.user_style_profile FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own style profile"
  ON public.user_style_profile FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own style profile"
  ON public.user_style_profile FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- 2. user_style_samples: every writing sample ingested
CREATE TABLE public.user_style_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL,
  content text NOT NULL,
  recipient_hint text,
  emotion_detected text,
  intent_detected text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_style_samples_user_created
  ON public.user_style_samples(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_style_samples TO authenticated;
GRANT ALL ON public.user_style_samples TO service_role;

ALTER TABLE public.user_style_samples ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own style samples"
  ON public.user_style_samples FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users insert own style samples"
  ON public.user_style_samples FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own style samples"
  ON public.user_style_samples FOR DELETE TO authenticated
  USING (auth.uid() = user_id);