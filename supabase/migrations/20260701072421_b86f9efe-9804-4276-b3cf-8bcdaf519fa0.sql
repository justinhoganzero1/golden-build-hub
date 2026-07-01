-- Harden SECURITY DEFINER functions: revoke EXECUTE from PUBLIC / anon / authenticated
-- for functions that must only be invoked by triggers or the service_role backend.
-- Trigger functions do not need EXECUTE grants for their firing role.

DO $$
DECLARE
  fn text;
  internal_fns text[] := ARRAY[
    -- Trigger-only
    'user_claims_lock_user_id()',
    'protect_suggestion_privileged_columns()',
    'capture_library_from_known_asset()',
    'guard_admin_role_assignment()',
    'handle_new_user()',
    'log_suggestion_free_access_denial()',
    'notify_stripe_event_error()',
    'enforce_single_active_living_gif()',
    'protect_user_claims_server_fields()',
    'update_updated_at_column()',
    -- Backend / service_role only
    'wallet_topup(uuid, integer)',
    'wallet_topup_logged(uuid, integer, integer, integer, text, text, text, jsonb)',
    'wallet_charge_call(uuid, text, text, integer, integer)',
    'wallet_charge_ai(uuid, text, integer, integer, jsonb)',
    'grant_signup_welcome(uuid)',
    'grant_referral_reward(uuid)',
    'claim_next_living_gif(text)',
    'claim_next_render_job(text)',
    'recalc_project_progress(uuid)',
    'log_auth_event(uuid, text, text, text, text, text, jsonb)',
    'check_margin_and_alert(numeric, integer)',
    'delete_user_account(uuid)',
    '_reschedule_cron(text, text, text)',
    'save_library_item_for_user(uuid, text, text, text, text, text, jsonb, boolean)',
    'check_ai_rate_limit_for(uuid, text, integer, integer)',
    -- Admin reporting (already gated by is_owner inside, but restrict callers too)
    'user_usage_breakdown(integer, integer)',
    'provider_pnl_summary(integer)',
    'stripe_event_summary(integer)',
    'count_user_jailbreak_attempts(uuid)'
  ];
BEGIN
  FOREACH fn IN ARRAY internal_fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION public.%s TO service_role', fn);
  END LOOP;
END $$;