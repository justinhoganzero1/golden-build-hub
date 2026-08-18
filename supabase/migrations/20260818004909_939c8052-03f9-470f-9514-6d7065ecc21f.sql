ALTER TABLE public.billing_budgets
  ADD COLUMN IF NOT EXISTS max_daily_limit_cents integer NOT NULL DEFAULT 20000,
  ADD COLUMN IF NOT EXISTS max_monthly_limit_cents integer NOT NULL DEFAULT 200000;

CREATE OR REPLACE FUNCTION public.enforce_billing_budget_ceiling()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_privileged boolean := (auth.uid() IS NULL) OR public.is_owner();
BEGIN
  IF v_is_privileged THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.max_daily_limit_cents := OLD.max_daily_limit_cents;
    NEW.max_monthly_limit_cents := OLD.max_monthly_limit_cents;
    NEW.user_id := OLD.user_id;
  ELSE
    NEW.max_daily_limit_cents := 20000;
    NEW.max_monthly_limit_cents := 200000;
  END IF;

  NEW.daily_limit_cents := LEAST(NEW.daily_limit_cents, NEW.max_daily_limit_cents);
  NEW.monthly_limit_cents := LEAST(NEW.monthly_limit_cents, NEW.max_monthly_limit_cents);
  NEW.hard_stop := true;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_billing_budget_ceiling() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_enforce_billing_budget_ceiling ON public.billing_budgets;
CREATE TRIGGER trg_enforce_billing_budget_ceiling
  BEFORE INSERT OR UPDATE ON public.billing_budgets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_billing_budget_ceiling();

UPDATE public.billing_budgets
SET daily_limit_cents = LEAST(daily_limit_cents, 20000),
    monthly_limit_cents = LEAST(monthly_limit_cents, 200000),
    hard_stop = true
WHERE daily_limit_cents > 20000
   OR monthly_limit_cents > 200000
   OR hard_stop = false;

CREATE OR REPLACE FUNCTION public.billing_expire_stale_holds()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  WITH expired AS (
    UPDATE public.billing_holds
    SET status = 'expired', released_at = now()
    WHERE status = 'held' AND expires_at <= now()
    RETURNING transaction_id
  )
  UPDATE public.billing_transactions t
  SET status = 'cancelled'
  FROM expired e
  WHERE t.id = e.transaction_id AND t.status IN ('pending', 'authorized');

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.billing_expire_stale_holds() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_expire_stale_holds() TO service_role;

CREATE TABLE IF NOT EXISTS public.agent_controls (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  agents_enabled boolean NOT NULL DEFAULT true,
  autonomous_actions_enabled boolean NOT NULL DEFAULT true,
  max_spend_per_invocation_cents integer NOT NULL DEFAULT 500 CHECK (max_spend_per_invocation_cents >= 0),
  max_actions_per_invocation integer NOT NULL DEFAULT 12 CHECK (max_actions_per_invocation >= 0),
  paused_reason text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.agent_controls (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.agent_controls ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.agent_controls TO authenticated;
GRANT ALL ON public.agent_controls TO service_role;

DROP POLICY IF EXISTS "Anyone signed in can read agent controls" ON public.agent_controls;
CREATE POLICY "Anyone signed in can read agent controls"
  ON public.agent_controls FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Only owner changes agent controls" ON public.agent_controls;
CREATE POLICY "Only owner changes agent controls"
  ON public.agent_controls FOR UPDATE TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());