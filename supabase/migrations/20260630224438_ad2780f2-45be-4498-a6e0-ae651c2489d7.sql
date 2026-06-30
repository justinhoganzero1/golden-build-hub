-- Move admin reporting & rate-limit helpers behind service_role only.
REVOKE EXECUTE ON FUNCTION public.provider_pnl_summary(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.user_usage_breakdown(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.stripe_event_summary(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_margin_and_alert(numeric, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_ai_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.provider_pnl_summary(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.user_usage_breakdown(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.stripe_event_summary(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_margin_and_alert(numeric, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit(text, integer, integer) TO service_role;

-- New service-role-only rate-limit variant: takes user_id explicitly so it
-- never depends on auth.uid() and can be called from an edge function admin
-- client without needing a user session.
CREATE OR REPLACE FUNCTION public.check_ai_rate_limit_for(_user_id uuid, _endpoint text, _limit integer DEFAULT 60, _window_seconds integer DEFAULT 60)
RETURNS TABLE(allowed boolean, current_count integer, rate_limit integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer;
BEGIN
  IF _user_id IS NULL THEN
    RETURN QUERY SELECT false, 0, _limit; RETURN;
  END IF;
  IF public.has_role(_user_id, 'admin'::public.app_role) THEN
    INSERT INTO public.ai_request_log (user_id, endpoint) VALUES (_user_id, _endpoint);
    RETURN QUERY SELECT true, 0, _limit; RETURN;
  END IF;
  SELECT COUNT(*)::int INTO v_count FROM public.ai_request_log
  WHERE user_id = _user_id AND endpoint = _endpoint
    AND created_at > now() - make_interval(secs => GREATEST(1, _window_seconds));
  IF v_count >= _limit THEN
    RETURN QUERY SELECT false, v_count, _limit; RETURN;
  END IF;
  INSERT INTO public.ai_request_log (user_id, endpoint) VALUES (_user_id, _endpoint);
  RETURN QUERY SELECT true, v_count + 1, _limit;
END $$;

REVOKE EXECUTE ON FUNCTION public.check_ai_rate_limit_for(uuid, text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_ai_rate_limit_for(uuid, text, integer, integer) TO service_role;
