ALTER TABLE public.racing_model_versions
  ADD COLUMN IF NOT EXISTS scenario text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'reference',
  ADD COLUMN IF NOT EXISTS parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS test_metrics jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS trained_at timestamptz;

ALTER TABLE public.racing_predictions DROP CONSTRAINT IF EXISTS racing_predictions_stage_check;
ALTER TABLE public.racing_predictions ADD CONSTRAINT racing_predictions_stage_check
  CHECK (stage IN ('morning','t30','t10','final','backtest','manual'));

CREATE INDEX IF NOT EXISTS racing_assessments_race_idx ON public.racing_engine_assessments (race_id, engine, created_at DESC);
CREATE INDEX IF NOT EXISTS racing_performances_jockey_idx ON public.racing_performances (jockey_id, race_date DESC);
CREATE INDEX IF NOT EXISTS racing_performances_trainer_idx ON public.racing_performances (trainer_id, race_date DESC);
CREATE INDEX IF NOT EXISTS racing_visual_obs_horse_idx ON public.racing_visual_observations (horse_id, observed_at DESC);