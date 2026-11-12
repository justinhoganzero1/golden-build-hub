ALTER TABLE public.site_arrivals ADD COLUMN IF NOT EXISTS country text CHECK (country IS NULL OR char_length(country) <= 60);
ALTER TABLE public.site_arrivals ADD COLUMN IF NOT EXISTS country_basis text CHECK (country_basis IS NULL OR country_basis IN ('network','timezone'));

CREATE OR REPLACE FUNCTION public.check_margin_and_alert(_threshold_pct numeric DEFAULT 15, _days integer DEFAULT 1)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_revenue bigint; v_cost bigint; v_margin numeric; v_alert_id uuid;
  v_start timestamptz := now() - make_interval(days => GREATEST(1,_days));
BEGIN
  -- Only customer charges count. The owner's own exempt use is a cost, not sales,
  -- so it must not pose as a pricing problem.
  SELECT COALESCE(SUM(c.total_cents),0), COALESCE(SUM(c.provider_cost_cents),0)
    INTO v_revenue, v_cost
  FROM public.ai_charges c
  WHERE c.created_at >= v_start
    AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = c.user_id AND r.role = 'admin');

  IF v_revenue <= 0 THEN RETURN NULL; END IF;
  v_margin := ROUND(((v_revenue - v_cost)::numeric / v_revenue::numeric) * 100, 2);

  IF v_margin < _threshold_pct THEN
    INSERT INTO public.margin_alerts (period_start, period_end, revenue_cents, est_provider_cost_cents, margin_pct, threshold_pct, severity)
    VALUES (v_start, now(), v_revenue, v_cost, v_margin, _threshold_pct,
      CASE WHEN v_margin < 0 THEN 'critical' WHEN v_margin < _threshold_pct/2 THEN 'high' ELSE 'warning' END)
    RETURNING id INTO v_alert_id;
  END IF;
  RETURN v_alert_id;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.check_margin_and_alert(numeric, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_margin_and_alert(numeric, integer) TO service_role;