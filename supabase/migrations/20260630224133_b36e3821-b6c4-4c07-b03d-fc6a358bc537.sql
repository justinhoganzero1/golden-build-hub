-- Tighten EXECUTE on internal-only SECURITY DEFINER helpers that are only ever
-- called by Edge Functions using the privileged service-role admin client.
-- Other SECURITY DEFINER helpers (has_role, is_owner, has_unlimited_ai,
-- has_app_unlock, has_active_reward, is_anon_visitor, is_owner_email_locked,
-- check_ai_rate_limit, photo_template_quota, save_library_item,
-- retry_failed_scene, provider_pnl_summary, user_usage_breakdown,
-- stripe_event_summary) MUST remain callable by `authenticated` because they
-- are referenced from RLS policies, client RPCs, or admin dashboards that
-- internally enforce is_owner() / auth.uid() = user_id.

REVOKE EXECUTE ON FUNCTION public.log_auth_event(uuid, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.count_user_jailbreak_attempts(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_oracle_usage(uuid, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.log_auth_event(uuid, text, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.count_user_jailbreak_attempts(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_oracle_usage(uuid, integer) TO service_role;

-- Defense in depth on suggestions: tighten the UPDATE RLS so even if a future
-- migration loosened the BEFORE trigger, a non-owner update that tries to
-- touch granted_free_access is rejected by RLS entirely.
DROP POLICY IF EXISTS "Users update own suggestions but not privileged fields" ON public.suggestions;

CREATE POLICY "Users update own suggestions but not privileged fields"
ON public.suggestions
FOR UPDATE
TO authenticated
USING (
  public.is_owner() OR (user_id = auth.uid())
)
WITH CHECK (
  public.is_owner() OR (
    user_id = auth.uid()
    AND COALESCE(granted_free_access, false) = false
    AND COALESCE(ai_quality_score, 0) = 0
    AND ai_response IS NULL
    AND status IN ('pending', 'draft')
  )
);

-- Same for INSERT: non-owners can never insert a row with granted_free_access=true.
DROP POLICY IF EXISTS "Users insert own suggestions without privileged fields" ON public.suggestions;

CREATE POLICY "Users insert own suggestions without privileged fields"
ON public.suggestions
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_owner() OR (
    user_id = auth.uid()
    AND COALESCE(granted_free_access, false) = false
    AND COALESCE(ai_quality_score, 0) = 0
    AND ai_response IS NULL
  )
);
