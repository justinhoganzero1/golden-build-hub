
-- 1. Column-level UPDATE lockdown: users may only edit descriptive/sharing fields.
REVOKE UPDATE ON public.living_gifs FROM authenticated, anon;
GRANT UPDATE (title, prompt, source_image_url, source_avatar_id, duration_seconds,
  resolution, is_active_oracle, is_public, shop_enabled, shop_price_cents,
  creator_display_name, updated_at)
  ON public.living_gifs TO authenticated;
GRANT ALL ON public.living_gifs TO service_role;

REVOKE UPDATE ON public.movie_projects FROM authenticated, anon;
GRANT UPDATE (title, logline, genre, target_duration_minutes, quality_tier, brief,
  full_script, director_intent, youtube_metadata, is_public, shop_enabled,
  shop_price_cents, creator_display_name, updated_at)
  ON public.movie_projects TO authenticated;
GRANT ALL ON public.movie_projects TO service_role;

-- 2. Belt-and-braces: extend the server-field guards to sharing/monetisation fields
--    on living_gifs (already covered for payment/status/url fields).
CREATE OR REPLACE FUNCTION public.protect_living_gifs_server_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF auth.role() = 'service_role' OR public.is_owner() THEN RETURN NEW; END IF;

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
    -- sharing/monetisation only allowed once the GIF actually exists
    IF OLD.status <> 'ready' OR OLD.gif_url IS NULL THEN
      NEW.is_public       := OLD.is_public;
      NEW.shop_enabled    := OLD.shop_enabled;
      NEW.shop_price_cents:= OLD.shop_price_cents;
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
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
    NEW.is_public             := false;
    NEW.shop_enabled          := false;
  END IF;
  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.protect_movie_projects_server_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  IF auth.role() = 'service_role' OR public.is_owner() THEN RETURN NEW; END IF;

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
    IF OLD.final_video_url IS NULL THEN
      NEW.is_public        := OLD.is_public;
      NEW.shop_enabled     := OLD.shop_enabled;
      NEW.shop_price_cents := OLD.shop_price_cents;
    END IF;
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
    NEW.is_public               := false;
    NEW.shop_enabled            := false;
  END IF;
  RETURN NEW;
END; $function$;

DROP TRIGGER IF EXISTS trg_protect_living_gifs ON public.living_gifs;
CREATE TRIGGER trg_protect_living_gifs
  BEFORE INSERT OR UPDATE ON public.living_gifs
  FOR EACH ROW EXECUTE FUNCTION public.protect_living_gifs_server_fields();

DROP TRIGGER IF EXISTS trg_protect_movie_projects ON public.movie_projects;
CREATE TRIGGER trg_protect_movie_projects
  BEFORE INSERT OR UPDATE ON public.movie_projects
  FOR EACH ROW EXECUTE FUNCTION public.protect_movie_projects_server_fields();

-- 3. Internal SECURITY DEFINER helpers should not be callable from the client API.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_anon_visitor(uuid) FROM authenticated, anon, public;
REVOKE EXECUTE ON FUNCTION public.is_owner_email_locked() FROM authenticated, anon, public;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_anon_visitor(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_owner_email_locked() TO service_role;
