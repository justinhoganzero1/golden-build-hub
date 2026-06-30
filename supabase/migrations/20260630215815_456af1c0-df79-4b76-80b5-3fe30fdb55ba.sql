-- Revoke EXECUTE on trigger-only and internal worker/admin functions from PUBLIC, anon, authenticated.
-- service_role retains access via ALL-by-default grant; triggers and edge functions still work.

DO $$
DECLARE
  f text;
  internal_fns text[] := ARRAY[
    -- trigger functions
    'user_claims_lock_user_id()',
    'capture_library_from_known_asset()',
    'protect_suggestion_privileged_columns()',
    'guard_admin_role_assignment()',
    'handle_new_user()',
    'notify_stripe_event_error()',
    'protect_user_claims_server_fields()',
    'enforce_single_active_living_gif()',
    'update_updated_at_column()',
    -- internal worker / cron / admin-only
    '_reschedule_cron(text, text, text)',
    'delete_user_account(uuid)',
    'grant_signup_welcome(uuid)',
    'grant_referral_reward(uuid)',
    'claim_next_render_job(text)',
    'claim_next_living_gif(text)',
    'check_margin_and_alert(numeric, integer)',
    'recalc_project_progress(uuid)',
    'save_library_item_for_user(uuid, text, text, text, text, text, jsonb, boolean)',
    'wallet_topup(uuid, integer)',
    'wallet_topup_logged(uuid, integer, integer, integer, text, text, text, jsonb)',
    'wallet_charge_ai(uuid, text, integer, integer, jsonb)',
    'wallet_charge_call(uuid, text, text, integer, integer)'
  ];
BEGIN
  FOREACH f IN ARRAY internal_fns LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM PUBLIC', f);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM anon', f);
      EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%s FROM authenticated', f);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'skipped missing function: %', f;
    END;
  END LOOP;
END $$;