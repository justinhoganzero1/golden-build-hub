ALTER TABLE public.racing_settings
  ADD COLUMN IF NOT EXISTS min_win_odds numeric NOT NULL DEFAULT 3.00 CHECK (min_win_odds >= 3.00 AND min_win_odds <= 100),
  ADD COLUMN IF NOT EXISTS min_confidence numeric NOT NULL DEFAULT 60 CHECK (min_confidence >= 0 AND min_confidence <= 100),
  ADD COLUMN IF NOT EXISTS min_expected_value numeric NOT NULL DEFAULT 0.05 CHECK (min_expected_value >= 0 AND min_expected_value <= 5),
  ADD COLUMN IF NOT EXISTS odds_refresh_minutes integer NOT NULL DEFAULT 15 CHECK (odds_refresh_minutes BETWEEN 5 AND 240),
  ADD COLUMN IF NOT EXISTS daily_scan_time text NOT NULL DEFAULT '07:00' CHECK (daily_scan_time ~ '^[0-2][0-9]:[0-5][0-9]$'),
  ADD COLUMN IF NOT EXISTS parade_lead_minutes integer NOT NULL DEFAULT 15 CHECK (parade_lead_minutes BETWEEN 1 AND 60),
  ADD COLUMN IF NOT EXISTS betting_deduction_pct numeric NOT NULL DEFAULT 0 CHECK (betting_deduction_pct >= 0 AND betting_deduction_pct <= 50),
  ADD COLUMN IF NOT EXISTS notification_prefs jsonb NOT NULL DEFAULT '{"report_ready":true,"new_selection":true,"parade_soon":true,"odds_below_floor":true,"scratched":true,"time_changed":true,"withdrawn":true,"browser":false}'::jsonb;

ALTER TABLE public.racing_races
  ADD COLUMN IF NOT EXISTS parade_time_utc timestamptz,
  ADD COLUMN IF NOT EXISTS race_code text NOT NULL DEFAULT 'thoroughbred';

CREATE TABLE public.racing_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_date date NOT NULL,
  racecourse_id uuid NOT NULL REFERENCES public.racing_racecourses(id) ON DELETE CASCADE,
  network text NOT NULL,
  channel text NOT NULL,
  platform text,
  starts_at timestamptz,
  status text NOT NULL DEFAULT 'unconfirmed' CHECK (status IN ('confirmed_live','scheduled','replay','unconfirmed')),
  race_numbers integer[] NOT NULL DEFAULT '{}',
  race_code text NOT NULL DEFAULT 'thoroughbred' CHECK (race_code = 'thoroughbred'),
  source text NOT NULL DEFAULT 'owner-import',
  source_url text,
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (broadcast_date, racecourse_id, channel)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.racing_broadcasts TO authenticated;
GRANT ALL ON public.racing_broadcasts TO service_role;
ALTER TABLE public.racing_broadcasts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages racing_broadcasts" ON public.racing_broadcasts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX racing_broadcasts_date_idx ON public.racing_broadcasts (broadcast_date);

CREATE TABLE public.racing_daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('qualifying','in_progress','no_winners','data_unavailable')),
  trigger text NOT NULL DEFAULT 'manual',
  meetings_analysed integer NOT NULL DEFAULT 0,
  races_analysed integer NOT NULL DEFAULT 0,
  qualifying_races integer NOT NULL DEFAULT 0,
  qualifying_selections integer NOT NULL DEFAULT 0,
  skipped_races integer NOT NULL DEFAULT 0,
  coverage jsonb NOT NULL DEFAULT '[]'::jsonb,
  problems jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  model_version text,
  data_retrieved_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.racing_daily_reports TO authenticated;
GRANT ALL ON public.racing_daily_reports TO service_role;
ALTER TABLE public.racing_daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages racing_daily_reports" ON public.racing_daily_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX racing_daily_reports_date_idx ON public.racing_daily_reports (report_date DESC, started_at DESC);

CREATE TABLE public.racing_selection_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES public.racing_daily_reports(id) ON DELETE SET NULL,
  prediction_id uuid REFERENCES public.racing_predictions(id) ON DELETE SET NULL,
  is_backtest boolean NOT NULL DEFAULT false,
  race_id uuid NOT NULL REFERENCES public.racing_races(id) ON DELETE CASCADE,
  runner_id uuid NOT NULL REFERENCES public.racing_runners(id) ON DELETE CASCADE,
  horse_name text,
  venue text,
  race_number integer,
  race_start_utc timestamptz,
  jockey_id uuid,
  decided_at timestamptz NOT NULL DEFAULT now(),
  odds_at_decision numeric,
  odds_source text,
  odds_kind text NOT NULL DEFAULT 'indicative' CHECK (odds_kind IN ('indicative','starting_price','unknown')),
  implied_prob numeric,
  market_prob numeric,
  oracle_prob numeric,
  expected_value numeric,
  confidence numeric,
  model_version text,
  min_odds_applied numeric NOT NULL DEFAULT 3.00,
  decision text NOT NULL CHECK (decision IN ('qualified','rejected')),
  reasons text[] NOT NULL DEFAULT '{}',
  latest_odds numeric,
  latest_odds_at timestamptz,
  withdrawn_at timestamptz,
  withdrawn_reason text,
  starting_price numeric,
  finish_position integer,
  payout numeric,
  profit numeric,
  settled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.racing_selection_decisions TO authenticated;
GRANT ALL ON public.racing_selection_decisions TO service_role;
ALTER TABLE public.racing_selection_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages racing_selection_decisions" ON public.racing_selection_decisions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX racing_selection_decisions_report_idx ON public.racing_selection_decisions (report_id);
CREATE INDEX racing_selection_decisions_race_idx ON public.racing_selection_decisions (race_id);
CREATE UNIQUE INDEX racing_selection_decisions_backtest_uniq ON public.racing_selection_decisions (prediction_id, runner_id) WHERE is_backtest;

CREATE OR REPLACE FUNCTION public.racing_decision_immutable()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF (NEW.report_id IS DISTINCT FROM OLD.report_id AND NEW.report_id IS NOT NULL)
     OR NEW.race_id IS DISTINCT FROM OLD.race_id OR NEW.runner_id IS DISTINCT FROM OLD.runner_id
     OR NEW.decided_at IS DISTINCT FROM OLD.decided_at OR NEW.odds_at_decision IS DISTINCT FROM OLD.odds_at_decision
     OR NEW.oracle_prob IS DISTINCT FROM OLD.oracle_prob OR NEW.expected_value IS DISTINCT FROM OLD.expected_value
     OR NEW.confidence IS DISTINCT FROM OLD.confidence OR NEW.decision IS DISTINCT FROM OLD.decision
     OR NEW.reasons IS DISTINCT FROM OLD.reasons OR NEW.model_version IS DISTINCT FROM OLD.model_version
     OR NEW.implied_prob IS DISTINCT FROM OLD.implied_prob OR NEW.market_prob IS DISTINCT FROM OLD.market_prob
     OR NEW.min_odds_applied IS DISTINCT FROM OLD.min_odds_applied OR NEW.is_backtest IS DISTINCT FROM OLD.is_backtest THEN
    RAISE EXCEPTION 'Selection decisions are permanent; only withdrawals, later prices and results can be added';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER racing_decision_immutable BEFORE UPDATE ON public.racing_selection_decisions
  FOR EACH ROW EXECUTE FUNCTION public.racing_decision_immutable();

CREATE TABLE public.racing_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('report_ready','new_selection','parade_soon','odds_below_floor','scratched','time_changed','withdrawn','jockey_changed')),
  title text NOT NULL,
  body text,
  race_id uuid REFERENCES public.racing_races(id) ON DELETE CASCADE,
  dedupe_key text NOT NULL UNIQUE,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.racing_notifications TO authenticated;
GRANT ALL ON public.racing_notifications TO service_role;
ALTER TABLE public.racing_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owner manages racing_notifications" ON public.racing_notifications FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE INDEX racing_notifications_created_idx ON public.racing_notifications (created_at DESC);

CREATE OR REPLACE FUNCTION public.racing_settings_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  changes jsonb := '{}'::jsonb;
  k text;
  o jsonb := to_jsonb(OLD) - 'controller_lock_until' - 'updated_at';
  n jsonb := to_jsonb(NEW) - 'controller_lock_until' - 'updated_at';
BEGIN
  FOR k IN SELECT jsonb_object_keys(n) LOOP
    IF (o -> k) IS DISTINCT FROM (n -> k) THEN
      changes := changes || jsonb_build_object(k, jsonb_build_object('from', o -> k, 'to', n -> k));
    END IF;
  END LOOP;
  IF changes <> '{}'::jsonb THEN
    INSERT INTO public.racing_audit_log (actor, action, detail)
    VALUES (coalesce(auth.jwt() ->> 'email', 'system'), 'settings_changed', changes);
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.racing_settings_audit() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER racing_settings_audit AFTER UPDATE ON public.racing_settings
  FOR EACH ROW EXECUTE FUNCTION public.racing_settings_audit();

INSERT INTO public.racing_providers (id, name, category, coverage, provides, credential_fields, adapter_ready, status, notes)
VALUES ('owner-broadcast', 'Your broadcast schedule (Seven / 7two / Racing.com / 7plus)', 'broadcast', ARRAY['AU'], ARRAY['broadcast schedule','channels','covered races'], ARRAY[]::text[], true, 'awaiting_configuration',
  'No licensed TV-guide feed for Seven racing coverage is connected. Import the day''s broadcast schedule from an official guide you are allowed to use; Oracle never assumes a race is televised.')
ON CONFLICT (id) DO NOTHING;