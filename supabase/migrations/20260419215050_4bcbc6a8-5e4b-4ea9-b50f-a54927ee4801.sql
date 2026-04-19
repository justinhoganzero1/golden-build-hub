
-- Per-user learned sound signatures
CREATE TABLE public.sound_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'unknown',
  -- Frequency-domain fingerprint: 32-bin normalized energy 0-1
  fingerprint JSONB NOT NULL DEFAULT '[]'::jsonb,
  centroid_hz NUMERIC,
  bandwidth_hz NUMERIC,
  peak_hz NUMERIC,
  duration_ms INTEGER,
  loudness_db NUMERIC,
  is_transient BOOLEAN NOT NULL DEFAULT false,
  is_continuous BOOLEAN NOT NULL DEFAULT false,
  action TEXT NOT NULL DEFAULT 'suppress', -- suppress | ignore | alert | learn
  associated_event TEXT, -- e.g. "doorbell", "smoke alarm", "kettle boiling"
  occurrences INTEGER NOT NULL DEFAULT 1,
  confidence NUMERIC NOT NULL DEFAULT 0.5,
  last_heard_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sound_signatures_user ON public.sound_signatures(user_id);
CREATE INDEX idx_sound_signatures_label ON public.sound_signatures(user_id, label);
CREATE INDEX idx_sound_signatures_category ON public.sound_signatures(user_id, category);

ALTER TABLE public.sound_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own signatures"
  ON public.sound_signatures FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_owner());

CREATE POLICY "Users insert own signatures"
  ON public.sound_signatures FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own signatures"
  ON public.sound_signatures FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR is_owner())
  WITH CHECK (auth.uid() = user_id OR is_owner());

CREATE POLICY "Users delete own signatures"
  ON public.sound_signatures FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR is_owner());

CREATE TRIGGER trg_sound_signatures_updated
  BEFORE UPDATE ON public.sound_signatures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Global, admin-curated noise pool everyone benefits from
CREATE TABLE public.global_sound_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL UNIQUE,
  category TEXT NOT NULL DEFAULT 'unknown',
  fingerprint JSONB NOT NULL DEFAULT '[]'::jsonb,
  centroid_hz NUMERIC,
  bandwidth_hz NUMERIC,
  peak_hz NUMERIC,
  duration_ms INTEGER,
  is_transient BOOLEAN NOT NULL DEFAULT false,
  is_continuous BOOLEAN NOT NULL DEFAULT false,
  action TEXT NOT NULL DEFAULT 'suppress',
  description TEXT,
  contributors INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_global_sound_category ON public.global_sound_signatures(category);

ALTER TABLE public.global_sound_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read global signatures"
  ON public.global_sound_signatures FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admin manages global signatures"
  ON public.global_sound_signatures FOR ALL
  TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());

CREATE TRIGGER trg_global_sound_updated
  BEFORE UPDATE ON public.global_sound_signatures
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed a few common signatures so users see value immediately
INSERT INTO public.global_sound_signatures (label, category, peak_hz, bandwidth_hz, is_transient, is_continuous, action, description)
VALUES
  ('Emergency siren', 'alarm', 1100, 800, false, true, 'alert', 'Sweeping 700-1600Hz tone — police/ambulance/fire'),
  ('Smoke alarm', 'alarm', 3200, 200, false, true, 'alert', 'Narrow ~3.2kHz beep'),
  ('Doorbell', 'household', 800, 600, true, false, 'alert', 'Two-tone chime'),
  ('Kettle boiling', 'household', 2200, 1500, false, true, 'suppress', 'Broadband hiss + whistle'),
  ('Dog bark', 'animal', 900, 1200, true, false, 'suppress', 'Sharp transient 500-1500Hz'),
  ('Vacuum cleaner', 'household', 400, 3000, false, true, 'suppress', 'Continuous broadband motor noise'),
  ('Traffic rumble', 'street', 80, 200, false, true, 'suppress', 'Sub-200Hz continuous'),
  ('Television speech', 'media', 1800, 2500, false, true, 'suppress', 'Continuous mid-band speech-like'),
  ('Dishes clatter', 'household', 4500, 3000, true, false, 'suppress', 'Sharp high-freq transient'),
  ('Phone ringtone', 'device', 1500, 1000, false, true, 'alert', 'Repeating tonal pattern')
ON CONFLICT (label) DO NOTHING;
