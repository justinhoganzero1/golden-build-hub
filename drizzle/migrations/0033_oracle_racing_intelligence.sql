-- Oracle Racing Intelligence: owner-only global racing research platform.
-- Every table is admin-only; provider credentials are service-only.

CREATE TABLE public.racing_countries (
  code text PRIMARY KEY,
  name text NOT NULL,
  data_notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.racing_providers (
  id text PRIMARY KEY,
  name text NOT NULL,
  category text NOT NULL,
  coverage text[] NOT NULL DEFAULT '{}',
  provides text[] NOT NULL DEFAULT '{}',
  docs_url text,
  credential_fields text[] NOT NULL DEFAULT '{}',
  adapter_ready boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'awaiting_configuration',
  last_success_at timestamptz,
  last_checked_at timestamptz,
  last_error text,
  rate_limit text,
  missing_permissions text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.racing_provider_credentials (
  provider_id text PRIMARY KEY REFERENCES public.racing_providers(id) ON DELETE CASCADE,
  secret_values jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.racing_racecourses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country_code text NOT NULL REFERENCES public.racing_countries(code),
  region text,
  latitude double precision,
  longitude double precision,
  timezone text,
  surface text,
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, country_code)
);

CREATE TABLE public.racing_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  racecourse_id uuid NOT NULL REFERENCES public.racing_racecourses(id) ON DELETE CASCADE,
  meeting_date date NOT NULL,
  provider_id text REFERENCES public.racing_providers(id),
  external_id text,
  track_rating text,
  rail_position text,
  status text NOT NULL DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, external_id)
);

CREATE TABLE public.racing_races (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.racing_meetings(id) ON DELETE CASCADE,
  race_number int NOT NULL,
  name text,
  start_time_utc timestamptz NOT NULL,
  distance_m int,
  race_class text,
  surface text,
  prize_money numeric,
  runners_count int,
  status text NOT NULL DEFAULT 'scheduled',
  provider_id text REFERENCES public.racing_providers(id),
  external_id text,
  data_completeness numeric,
  suitability_score numeric,
  suitability_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  has_paddock_video boolean NOT NULL DEFAULT false,
  has_training_video boolean NOT NULL DEFAULT false,
  selected boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_id, external_id)
);
CREATE INDEX racing_races_start_idx ON public.racing_races (start_time_utc);

CREATE TABLE public.racing_horses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country_code text,
  foaled date,
  sex text,
  colour text,
  sire text,
  dam text,
  dam_sire text,
  breeder text,
  aliases jsonb NOT NULL DEFAULT '[]'::jsonb,
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX racing_horses_name_idx ON public.racing_horses (lower(name));

CREATE TABLE public.racing_jockeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country_code text,
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.racing_trainers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  country_code text,
  external_ids jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.racing_runners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id uuid NOT NULL REFERENCES public.racing_races(id) ON DELETE CASCADE,
  horse_id uuid NOT NULL REFERENCES public.racing_horses(id),
  jockey_id uuid REFERENCES public.racing_jockeys(id),
  trainer_id uuid REFERENCES public.racing_trainers(id),
  saddlecloth int,
  barrier int,
  weight_kg numeric,
  scratched boolean NOT NULL DEFAULT false,
  odds jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (race_id, horse_id)
);
CREATE INDEX racing_runners_horse_idx ON public.racing_runners (horse_id);

CREATE TABLE public.racing_performances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  horse_id uuid NOT NULL REFERENCES public.racing_horses(id) ON DELETE CASCADE,
  race_date date NOT NULL,
  racecourse_id uuid REFERENCES public.racing_racecourses(id),
  distance_m int,
  surface text,
  track_rating text,
  race_class text,
  finish_position int,
  field_size int,
  margin_lengths numeric,
  race_time_s numeric,
  sectionals jsonb NOT NULL DEFAULT '{}'::jsonb,
  weight_kg numeric,
  barrier int,
  jockey_id uuid REFERENCES public.racing_jockeys(id),
  trainer_id uuid REFERENCES public.racing_trainers(id),
  source_provider text REFERENCES public.racing_providers(id),
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX racing_performances_horse_idx ON public.racing_performances (horse_id, race_date DESC);

CREATE TABLE public.racing_weather_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  racecourse_id uuid NOT NULL REFERENCES public.racing_racecourses(id) ON DELETE CASCADE,
  observed_for timestamptz NOT NULL,
  kind text NOT NULL CHECK (kind IN ('model_current','forecast','official_track')),
  temperature_c numeric,
  humidity_pct numeric,
  wind_kph numeric,
  wind_direction_deg numeric,
  rain_mm numeric,
  track_rating text,
  source text NOT NULL,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX racing_weather_course_idx ON public.racing_weather_observations (racecourse_id, created_at DESC);

CREATE TABLE public.racing_video_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id text REFERENCES public.racing_providers(id),
  race_id uuid REFERENCES public.racing_races(id) ON DELETE SET NULL,
  horse_id uuid REFERENCES public.racing_horses(id) ON DELETE SET NULL,
  kind text NOT NULL CHECK (kind IN ('paddock','race','training','trial','warmup','owner_upload')),
  source_url text,
  storage_path text,
  recorded_at timestamptz,
  licence_note text,
  quality text,
  identification_confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.racing_visual_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id uuid REFERENCES public.racing_video_sources(id) ON DELETE CASCADE,
  horse_id uuid REFERENCES public.racing_horses(id) ON DELETE CASCADE,
  race_id uuid REFERENCES public.racing_races(id) ON DELETE SET NULL,
  observed_at timestamptz,
  available boolean NOT NULL DEFAULT true,
  objective_measures jsonb NOT NULL DEFAULT '{}'::jsonb,
  ai_interpretation text,
  confidence numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.racing_model_versions (
  id text PRIMARY KEY,
  description text NOT NULL,
  method text NOT NULL,
  validated_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.racing_engine_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  engine text NOT NULL,
  status text NOT NULL CHECK (status IN ('running','succeeded','failed','awaiting_configuration','waiting_for_data','skipped')),
  task text,
  progress int NOT NULL DEFAULT 0,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  trigger text NOT NULL DEFAULT 'manual',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX racing_engine_runs_engine_idx ON public.racing_engine_runs (engine, started_at DESC);

CREATE TABLE public.racing_engine_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id uuid NOT NULL REFERENCES public.racing_races(id) ON DELETE CASCADE,
  runner_id uuid REFERENCES public.racing_runners(id) ON DELETE CASCADE,
  engine text NOT NULL,
  model_version text REFERENCES public.racing_model_versions(id),
  assessment jsonb NOT NULL DEFAULT '{}'::jsonb,
  data_quality numeric,
  evidence_cutoff timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.racing_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id uuid NOT NULL REFERENCES public.racing_races(id) ON DELETE CASCADE,
  model_version text NOT NULL REFERENCES public.racing_model_versions(id),
  stage text NOT NULL CHECK (stage IN ('morning','t30','t10','final','backtest')),
  scenario text NOT NULL DEFAULT 'D' CHECK (scenario IN ('A','B','C','D')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','locked','insufficient_data')),
  analytical_confidence numeric,
  explanation text,
  limitations text,
  evidence_cutoff timestamptz NOT NULL,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX racing_predictions_race_idx ON public.racing_predictions (race_id, created_at DESC);

CREATE TABLE public.racing_prediction_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id uuid NOT NULL REFERENCES public.racing_predictions(id) ON DELETE CASCADE,
  runner_id uuid NOT NULL REFERENCES public.racing_runners(id),
  predicted_rank int NOT NULL,
  p_win numeric, p_top2 numeric, p_top3 numeric, p_top4 numeric,
  UNIQUE (prediction_id, runner_id)
);

CREATE TABLE public.racing_results (
  race_id uuid PRIMARY KEY REFERENCES public.racing_races(id) ON DELETE CASCADE,
  official_order jsonb NOT NULL,
  source_provider text REFERENCES public.racing_providers(id),
  verified_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.racing_accuracy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prediction_id uuid NOT NULL REFERENCES public.racing_predictions(id) ON DELETE CASCADE,
  race_id uuid NOT NULL REFERENCES public.racing_races(id) ON DELETE CASCADE,
  scenario text NOT NULL DEFAULT 'D',
  winner_hit boolean, top2_hit boolean, top3_hit boolean, exacta_hit boolean,
  rank_correlation numeric, brier_score numeric, log_loss numeric,
  computed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (prediction_id)
);

CREATE TABLE public.racing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  race_id uuid NOT NULL REFERENCES public.racing_races(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('morning','t30','t20','t10','t5','post')),
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','failed','skipped')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  finished_at timestamptz,
  UNIQUE (race_id, kind)
);
CREATE INDEX racing_jobs_due_idx ON public.racing_jobs (status, due_at);

CREATE TABLE public.racing_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  display_timezone text NOT NULL DEFAULT 'Australia/Brisbane',
  selection_mode text NOT NULL DEFAULT 'top10' CHECK (selection_mode IN ('all','top5','top10','top20','custom')),
  custom_count int NOT NULL DEFAULT 10,
  automation_enabled boolean NOT NULL DEFAULT true,
  controller_lock_until timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.racing_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor text NOT NULL,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Locked predictions are permanent: no edits or deletes after lock.
CREATE OR REPLACE FUNCTION public.racing_protect_locked_predictions()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'locked' THEN
    RAISE EXCEPTION 'Locked racing predictions cannot be changed or deleted';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER racing_predictions_locked_guard BEFORE UPDATE OR DELETE ON public.racing_predictions
  FOR EACH ROW EXECUTE FUNCTION public.racing_protect_locked_predictions();

CREATE OR REPLACE FUNCTION public.racing_protect_locked_rankings()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE pid uuid := COALESCE(NEW.prediction_id, OLD.prediction_id);
BEGIN
  IF EXISTS (SELECT 1 FROM public.racing_predictions WHERE id = pid AND status = 'locked') THEN
    RAISE EXCEPTION 'Rankings of a locked prediction cannot be changed';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER racing_rankings_locked_guard BEFORE INSERT OR UPDATE OR DELETE ON public.racing_prediction_rankings
  FOR EACH ROW EXECUTE FUNCTION public.racing_protect_locked_rankings();

-- Grants + owner-only access
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['racing_countries','racing_providers','racing_racecourses','racing_meetings','racing_races',
    'racing_horses','racing_jockeys','racing_trainers','racing_runners','racing_performances','racing_weather_observations',
    'racing_video_sources','racing_visual_observations','racing_model_versions','racing_engine_runs','racing_engine_assessments',
    'racing_predictions','racing_prediction_rankings','racing_results','racing_accuracy','racing_jobs','racing_settings','racing_audit_log']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Owner manages %s" ON public.%I FOR ALL TO authenticated USING (public.has_role(auth.uid(), ''admin'')) WITH CHECK (public.has_role(auth.uid(), ''admin''))', t, t);
  END LOOP;
END $$;

GRANT ALL ON public.racing_provider_credentials TO service_role;
ALTER TABLE public.racing_provider_credentials ENABLE ROW LEVEL SECURITY;