
-- ============================================================
-- 1) Payment/cost tamper protection triggers
-- ============================================================

-- living_gifs: lock payment + generation output columns
CREATE OR REPLACE FUNCTION public.protect_living_gifs_server_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_owner() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.status                := OLD.status;
    NEW.amount_paid_cents     := OLD.amount_paid_cents;
    NEW.currency              := OLD.currency;
    NEW.stripe_session_id     := OLD.stripe_session_id;
    NEW.stripe_payment_intent := OLD.stripe_payment_intent;
    NEW.gif_url               := OLD.gif_url;
    NEW.preview_mp4_url       := OLD.preview_mp4_url;
    NEW.thumbnail_url         := OLD.thumbnail_url;
    NEW.generated_at          := OLD.generated_at;
    NEW.pipeline_stage        := OLD.pipeline_stage;
    NEW.runway_task_id        := OLD.runway_task_id;
    NEW.replicate_prediction_id := OLD.replicate_prediction_id;
    NEW.attempts              := OLD.attempts;
    NEW.max_attempts          := OLD.max_attempts;
    NEW.locked_at             := OLD.locked_at;
    NEW.locked_by             := OLD.locked_by;
    NEW.last_progress_at      := OLD.last_progress_at;
    NEW.error_message         := OLD.error_message;
    NEW.download_count        := OLD.download_count;
    NEW.view_count            := OLD.view_count;
  ELSIF TG_OP = 'INSERT' THEN
    -- Force safe initial values so a user can't self-mark as paid/completed
    NEW.status                := COALESCE(NULLIF(NEW.status,''), 'pending_payment');
    IF NEW.status NOT IN ('pending_payment','queued','draft') THEN
      NEW.status := 'pending_payment';
    END IF;
    NEW.amount_paid_cents     := 0;
    NEW.stripe_session_id     := NULL;
    NEW.stripe_payment_intent := NULL;
    NEW.gif_url               := NULL;
    NEW.preview_mp4_url       := NULL;
    NEW.generated_at          := NULL;
    NEW.pipeline_stage        := NULL;
    NEW.runway_task_id        := NULL;
    NEW.replicate_prediction_id := NULL;
    NEW.attempts              := 0;
    NEW.locked_at             := NULL;
    NEW.locked_by             := NULL;
    NEW.last_progress_at      := NULL;
    NEW.error_message         := NULL;
    NEW.download_count        := 0;
    NEW.view_count            := 0;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_living_gifs ON public.living_gifs;
CREATE TRIGGER trg_protect_living_gifs
  BEFORE INSERT OR UPDATE ON public.living_gifs
  FOR EACH ROW EXECUTE FUNCTION public.protect_living_gifs_server_fields();

-- movie_projects: lock payment/financial/result columns
CREATE OR REPLACE FUNCTION public.protect_movie_projects_server_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_owner() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.payment_status          := OLD.payment_status;
    NEW.stripe_session_id       := OLD.stripe_session_id;
    NEW.stripe_payment_intent   := OLD.stripe_payment_intent;
    NEW.user_paid_cents         := OLD.user_paid_cents;
    NEW.spent_cost_cents        := OLD.spent_cost_cents;
    NEW.estimated_cost_cents    := OLD.estimated_cost_cents;
    NEW.paid_at                 := OLD.paid_at;
    NEW.final_video_url         := OLD.final_video_url;
    NEW.trailer_url             := OLD.trailer_url;
    NEW.thumbnail_url           := OLD.thumbnail_url;
    NEW.youtube_video_id        := OLD.youtube_video_id;
    NEW.shotstack_render_id     := OLD.shotstack_render_id;
    NEW.shotstack_status        := OLD.shotstack_status;
    NEW.thumbnail_status        := OLD.thumbnail_status;
    NEW.trailer_status          := OLD.trailer_status;
    NEW.status                  := OLD.status;
    NEW.total_scenes            := OLD.total_scenes;
    NEW.completed_scenes        := OLD.completed_scenes;
    NEW.failed_scenes           := OLD.failed_scenes;
    NEW.error_count             := OLD.error_count;
    NEW.last_error              := OLD.last_error;
    NEW.started_at              := OLD.started_at;
    NEW.completed_at            := OLD.completed_at;
    NEW.download_count          := OLD.download_count;
    NEW.view_count              := OLD.view_count;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.payment_status          := 'pending';
    NEW.stripe_session_id       := NULL;
    NEW.stripe_payment_intent   := NULL;
    NEW.user_paid_cents         := 0;
    NEW.spent_cost_cents        := 0;
    NEW.paid_at                 := NULL;
    NEW.final_video_url         := NULL;
    NEW.trailer_url             := NULL;
    NEW.youtube_video_id        := NULL;
    NEW.shotstack_render_id     := NULL;
    NEW.shotstack_status        := NULL;
    NEW.thumbnail_status        := NULL;
    NEW.trailer_status          := NULL;
    NEW.completed_scenes        := 0;
    NEW.failed_scenes           := 0;
    NEW.error_count             := 0;
    NEW.started_at              := NULL;
    NEW.completed_at            := NULL;
    NEW.download_count          := 0;
    NEW.view_count              := 0;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_movie_projects ON public.movie_projects;
CREATE TRIGGER trg_protect_movie_projects
  BEFORE INSERT OR UPDATE ON public.movie_projects
  FOR EACH ROW EXECUTE FUNCTION public.protect_movie_projects_server_fields();

-- movie_scenes: lock render cost and output URLs
CREATE OR REPLACE FUNCTION public.protect_movie_scenes_server_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.is_owner() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.provider_cost_cents := OLD.provider_cost_cents;
    NEW.video_1080p_url     := OLD.video_1080p_url;
    NEW.video_4k_url        := OLD.video_4k_url;
    NEW.video_8k_url        := OLD.video_8k_url;
    NEW.audio_url           := OLD.audio_url;
    NEW.music_url           := OLD.music_url;
    NEW.sfx_url             := OLD.sfx_url;
    NEW.lipsync_url         := OLD.lipsync_url;
    NEW.final_scene_url     := OLD.final_scene_url;
    NEW.status              := OLD.status;
    NEW.retry_count         := OLD.retry_count;
    NEW.last_error          := OLD.last_error;
    NEW.started_at          := OLD.started_at;
    NEW.completed_at        := OLD.completed_at;
  ELSIF TG_OP = 'INSERT' THEN
    NEW.provider_cost_cents := 0;
    NEW.video_1080p_url     := NULL;
    NEW.video_4k_url        := NULL;
    NEW.video_8k_url        := NULL;
    NEW.audio_url           := NULL;
    NEW.music_url           := NULL;
    NEW.sfx_url             := NULL;
    NEW.lipsync_url         := NULL;
    NEW.final_scene_url     := NULL;
    NEW.retry_count         := 0;
    NEW.last_error          := NULL;
    NEW.started_at          := NULL;
    NEW.completed_at        := NULL;
  END IF;

  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_movie_scenes ON public.movie_scenes;
CREATE TRIGGER trg_protect_movie_scenes
  BEFORE INSERT OR UPDATE ON public.movie_scenes
  FOR EACH ROW EXECUTE FUNCTION public.protect_movie_scenes_server_fields();


-- ============================================================
-- 2) Lock down EXECUTE on SECURITY DEFINER functions
-- ============================================================
-- Revoke EXECUTE from PUBLIC/anon/authenticated on every SECURITY DEFINER
-- function in the public schema; then grant back only to the roles that
-- actually need it. service_role always retains full access.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %I.%I(%s) FROM PUBLIC, anon, authenticated',
                   r.nspname, r.proname, r.args);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %I.%I(%s) TO service_role',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- Grant EXECUTE back to authenticated only for intentionally client-callable
-- functions (their bodies each perform their own owner/role checks or are
-- required inside RLS policies).
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role)          TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.is_owner()                                TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner_email_locked()                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_anon_visitor(uuid)                     TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_unlimited_ai(uuid)                    TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_reward(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_app_unlock(uuid, text)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.photo_template_quota(uuid)                TO authenticated;
GRANT EXECUTE ON FUNCTION public.retry_failed_scene(uuid)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_library_item(text, text, text, text, text, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, integer, integer)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_topup_user(uuid, integer, text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_wallet_balance(uuid, integer)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_free_for_life(uuid, boolean)    TO authenticated;
