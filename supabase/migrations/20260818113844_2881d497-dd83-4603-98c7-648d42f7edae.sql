-- 1. Harden owner/admin gate (defense in depth for all owner-only PII policies)
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT public.has_role(auth.uid(), 'admin')
     AND EXISTS (
       SELECT 1 FROM auth.users u
       WHERE u.id = auth.uid()
         AND u.email_confirmed_at IS NOT NULL
         AND COALESCE(u.is_anonymous, false) = false
     );
$function$;

-- 2. creator_comments: public may submit, never read
REVOKE SELECT, UPDATE, DELETE ON public.creator_comments FROM anon;
GRANT INSERT ON public.creator_comments TO anon;

-- 3. Hide internal worker metadata from end users (incl. realtime payloads)
REVOKE SELECT ON public.movie_render_jobs FROM authenticated, anon;
GRANT SELECT (id, project_id, scene_id, user_id, job_type, priority, status,
              attempts, max_attempts, payload, result, scheduled_for,
              started_at, completed_at, created_at, updated_at)
  ON public.movie_render_jobs TO authenticated;

REVOKE SELECT ON public.movie_scenes FROM authenticated, anon;
GRANT SELECT (id, project_id, user_id, scene_number, script_text, visual_prompt,
              location, time_of_day, mood, duration_seconds, characters, dialogue,
              video_1080p_url, video_4k_url, video_8k_url, audio_url, music_url,
              sfx_url, lipsync_url, final_scene_url, status, retry_count, last_error,
              started_at, completed_at, created_at, updated_at)
  ON public.movie_scenes TO authenticated;

GRANT ALL ON public.movie_render_jobs TO service_role;
GRANT ALL ON public.movie_scenes TO service_role;