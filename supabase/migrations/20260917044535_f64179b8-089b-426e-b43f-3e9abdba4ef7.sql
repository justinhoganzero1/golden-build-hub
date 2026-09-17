CREATE OR REPLACE FUNCTION public.resolve_ai_tier(_user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN public.has_role(_user_id, 'admin'::public.app_role) THEN 'admin'
    WHEN EXISTS (
      SELECT 1 FROM public.reward_grants g
      WHERE g.user_id = _user_id
        AND (g.reward_type IN ('free_for_life','unlimited_ai','lifetime','tier3_trial'))
    ) THEN 'admin'
    WHEN EXISTS (
      SELECT 1 FROM public.wallet_balances w
      WHERE w.user_id = _user_id AND w.balance_cents > 0
    ) THEN 'paying'
    WHEN EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = _user_id AND u.created_at > now() - interval '7 days'
    ) THEN 'trial'
    ELSE 'free'
  END;
$function$;

INSERT INTO public.ai_usage_limits (service, tier, max_requests_day, max_cost_cents_day, max_requests_month, max_cost_cents_month, cooldown_seconds, enabled)
VALUES
  ('default','free', 10, 10, 120, 100, 5, true),
  ('chat','free', 10, 10, 150, 100, 3, true),
  ('image','free', 1, 10, 10, 60, 30, true),
  ('tts','free', 2, 10, 20, 60, 20, true),
  ('video','free', 0, 0, 0, 0, 60, true),
  ('movie_render','free', 0, 0, 0, 0, 60, true)
ON CONFLICT (service, tier) DO UPDATE SET
  max_requests_day = EXCLUDED.max_requests_day,
  max_cost_cents_day = EXCLUDED.max_cost_cents_day,
  max_requests_month = EXCLUDED.max_requests_month,
  max_cost_cents_month = EXCLUDED.max_cost_cents_month,
  cooldown_seconds = EXCLUDED.cooldown_seconds,
  enabled = true;