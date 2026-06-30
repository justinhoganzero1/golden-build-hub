
-- ============================================================
-- auth_audit_log: failed auths and denied privileged actions
-- ============================================================
CREATE TABLE IF NOT EXISTS public.auth_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NULL,
  email text NULL,
  ip text NULL,
  path text NULL,
  event_type text NOT NULL,         -- e.g. 'auth_required','forbidden','denied_free_access','rate_limited'
  reason text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.auth_audit_log TO authenticated;
GRANT ALL ON public.auth_audit_log TO service_role;

ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner can read auth audit log"
  ON public.auth_audit_log FOR SELECT
  TO authenticated
  USING (public.is_owner());

CREATE INDEX IF NOT EXISTS auth_audit_log_created_at_idx ON public.auth_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS auth_audit_log_user_id_idx ON public.auth_audit_log (user_id);
CREATE INDEX IF NOT EXISTS auth_audit_log_event_type_idx ON public.auth_audit_log (event_type);

-- ============================================================
-- ai_request_log: per-call ledger for rate limiting
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_request_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  endpoint text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ai_request_log TO authenticated;
GRANT ALL ON public.ai_request_log TO service_role;

ALTER TABLE public.ai_request_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own ai request log"
  ON public.ai_request_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_owner());

CREATE INDEX IF NOT EXISTS ai_request_log_user_created_idx
  ON public.ai_request_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_request_log_created_idx
  ON public.ai_request_log (created_at DESC);

-- ============================================================
-- log_auth_event: write to auth_audit_log from edge functions
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_auth_event(
  _user_id uuid,
  _email text,
  _ip text,
  _path text,
  _event_type text,
  _reason text,
  _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  INSERT INTO public.auth_audit_log (user_id, email, ip, path, event_type, reason, metadata)
  VALUES (_user_id, _email, _ip, _path, _event_type, _reason, COALESCE(_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_auth_event(uuid, text, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_auth_event(uuid, text, text, text, text, text, jsonb) TO authenticated, service_role;

-- ============================================================
-- check_ai_rate_limit: insert + count within window
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit(
  _endpoint text,
  _limit integer DEFAULT 60,
  _window_seconds integer DEFAULT 60
) RETURNS TABLE(allowed boolean, current_count integer, rate_limit integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count integer;
BEGIN
  IF v_uid IS NULL THEN
    RETURN QUERY SELECT false, 0, _limit;
    RETURN;
  END IF;

  -- Admin bypass
  IF public.has_role(v_uid, 'admin'::public.app_role) THEN
    INSERT INTO public.ai_request_log (user_id, endpoint) VALUES (v_uid, _endpoint);
    RETURN QUERY SELECT true, 0, _limit;
    RETURN;
  END IF;

  SELECT COUNT(*)::int INTO v_count
  FROM public.ai_request_log
  WHERE user_id = v_uid
    AND endpoint = _endpoint
    AND created_at > now() - make_interval(secs => GREATEST(1, _window_seconds));

  IF v_count >= _limit THEN
    RETURN QUERY SELECT false, v_count, _limit;
    RETURN;
  END IF;

  INSERT INTO public.ai_request_log (user_id, endpoint) VALUES (v_uid, _endpoint);
  RETURN QUERY SELECT true, v_count + 1, _limit;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_ai_rate_limit(text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(text, integer, integer) TO authenticated, service_role;

-- ============================================================
-- log_suggestion_free_access_denial: audit denied attempts
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_suggestion_free_access_denial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attempted boolean := false;
BEGIN
  IF public.is_owner() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_attempted := COALESCE(NEW.granted_free_access, false) = true;
  ELSIF TG_OP = 'UPDATE' THEN
    v_attempted := COALESCE(NEW.granted_free_access, false) IS DISTINCT FROM COALESCE(OLD.granted_free_access, false);
  END IF;

  IF v_attempted THEN
    INSERT INTO public.auth_audit_log (user_id, path, event_type, reason, metadata)
    VALUES (
      auth.uid(),
      'suggestions',
      'denied_free_access',
      'non-owner attempted to set granted_free_access',
      jsonb_build_object('op', TG_OP, 'suggestion_id', COALESCE(NEW.id, OLD.id))
    );
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.log_suggestion_free_access_denial() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS audit_suggestion_free_access_insert ON public.suggestions;
DROP TRIGGER IF EXISTS audit_suggestion_free_access_update ON public.suggestions;

-- Fire BEFORE the protect_suggestion_privileged_columns trigger strips the value,
-- so the attempt is still visible. Trigger order is alphabetical; "audit_" < "protect_".
CREATE TRIGGER audit_suggestion_free_access_insert
  BEFORE INSERT ON public.suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_suggestion_free_access_denial();

CREATE TRIGGER audit_suggestion_free_access_update
  BEFORE UPDATE ON public.suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_suggestion_free_access_denial();
