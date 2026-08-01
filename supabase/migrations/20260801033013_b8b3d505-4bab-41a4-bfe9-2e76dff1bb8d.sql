-- 1. Remove full-row public read access
DROP POLICY IF EXISTS "Anyone views public gifs" ON public.living_gifs;
DROP POLICY IF EXISTS "Anyone views public movies" ON public.movie_projects;
DROP POLICY IF EXISTS "Anyone views public media" ON public.user_media;

-- 2. Display-safe public views (owned by postgres => bypass RLS, filtered here)
CREATE OR REPLACE VIEW public.public_living_gifs AS
SELECT id, title, gif_url, preview_mp4_url, thumbnail_url, duration_seconds,
       resolution, creator_display_name, shop_enabled, shop_price_cents,
       download_count, view_count, created_at
FROM public.living_gifs
WHERE is_public = true AND status = 'completed';

CREATE OR REPLACE VIEW public.public_movie_projects AS
SELECT id, title, logline, genre, target_duration_minutes, quality_tier,
       final_video_url, trailer_url, thumbnail_url, youtube_video_id,
       creator_display_name, shop_enabled, shop_price_cents,
       download_count, view_count, created_at
FROM public.movie_projects
WHERE is_public = true AND status = 'completed'::movie_project_status;

CREATE OR REPLACE VIEW public.public_user_media AS
SELECT id, media_type, title, url, thumbnail_url, source_page,
       creator_display_name, shop_enabled, shop_price_cents,
       download_count, view_count, created_at
FROM public.user_media
WHERE is_public = true;

CREATE OR REPLACE VIEW public.public_stories AS
SELECT id,
       title,
       metadata->>'slug'       AS slug,
       metadata->>'genre'      AS genre,
       metadata->>'premise'    AS premise,
       metadata->>'authorName' AS author_name,
       CASE WHEN jsonb_typeof(metadata->'chapters') = 'array'
            THEN metadata->'chapters' ELSE '[]'::jsonb END AS chapters,
       updated_at, created_at
FROM public.user_media
WHERE is_public = true AND media_type = 'story';

GRANT SELECT ON public.public_living_gifs TO anon, authenticated;
GRANT SELECT ON public.public_movie_projects TO anon, authenticated;
GRANT SELECT ON public.public_user_media TO anon, authenticated;
GRANT SELECT ON public.public_stories TO anon, authenticated;

-- 3. Story doc loader no longer depends on the removed public policy
CREATE OR REPLACE FUNCTION public.get_story_writer_document(_story_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'id', um.id,
    'title', coalesce(um.title, ''),
    'author', coalesce(um.metadata->>'author', um.metadata->>'authorName', ''),
    'genre', coalesce(um.metadata->>'genre', 'Fantasy'),
    'premise', coalesce(um.metadata->>'premise', ''),
    'published', coalesce((um.metadata->>'published')::boolean, false),
    'publishedUrl', um.metadata->>'publishedUrl',
    'coverImage', CASE
      WHEN length(coalesce(um.metadata->>'coverImage', '')) < 200000 THEN um.metadata->>'coverImage'
      ELSE NULL
    END,
    'backImage', CASE
      WHEN length(coalesce(um.metadata->>'backImage', '')) < 200000 THEN um.metadata->>'backImage'
      ELSE NULL
    END,
    'chapters', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'title', coalesce(chapter->>'title', 'Chapter ' || ordinality::text),
          'content', coalesce(chapter->>'content', ''),
          'images', coalesce((
            SELECT jsonb_agg(img)
            FROM jsonb_array_elements_text(
              CASE WHEN jsonb_typeof(chapter->'images') = 'array'
                   THEN chapter->'images' ELSE '[]'::jsonb END
            ) AS t(img)
            WHERE length(img) < 4000
          ), '[]'::jsonb)
        )
        ORDER BY ordinality
      )
      FROM jsonb_array_elements(coalesce(um.metadata->'chapters', '[]'::jsonb)) WITH ORDINALITY AS c(chapter, ordinality)
    ), jsonb_build_array(jsonb_build_object('title', 'Chapter 1', 'content', '', 'images', '[]'::jsonb)))
  )
  FROM public.user_media um
  WHERE um.id = _story_id
    AND um.media_type = 'story'
    AND um.source_page = 'story-writer'
    AND (um.user_id = auth.uid() OR public.is_owner() OR um.is_public = true)
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_story_writer_images(_story_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'coverImage', um.metadata->>'coverImage',
    'backImage', um.metadata->>'backImage',
    'chapterImages', coalesce((
      SELECT jsonb_agg(
        CASE WHEN jsonb_typeof(chapter->'images') = 'array'
             THEN chapter->'images' ELSE '[]'::jsonb END
        ORDER BY ordinality
      )
      FROM jsonb_array_elements(coalesce(um.metadata->'chapters', '[]'::jsonb)) WITH ORDINALITY AS c(chapter, ordinality)
    ), '[]'::jsonb)
  )
  FROM public.user_media um
  WHERE um.id = _story_id
    AND um.media_type = 'story'
    AND um.source_page = 'story-writer'
    AND (um.user_id = auth.uid() OR public.is_owner() OR um.is_public = true)
  LIMIT 1;
$function$;

-- 4. Self-scope the definer helper functions callable by signed-in users
CREATE OR REPLACE FUNCTION public.has_active_reward(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user_id IS NULL OR (_user_id <> auth.uid() AND NOT public.is_owner()) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.reward_grants
      WHERE user_id = _user_id AND active = true AND expires_at > now()
    )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.has_app_unlock(_user_id uuid, _app_key text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user_id IS NULL OR (_user_id <> auth.uid() AND NOT public.is_owner()) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.app_unlocks
      WHERE user_id = _user_id AND app_key = _app_key
    ) OR public.has_role(_user_id, 'admin')
  END;
$function$;

CREATE OR REPLACE FUNCTION public.has_unlimited_ai(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN _user_id IS NULL OR (_user_id <> auth.uid() AND NOT public.is_owner() AND auth.role() <> 'service_role') THEN false
    ELSE public.has_role(_user_id, 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.reward_grants
        WHERE user_id = _user_id AND active = true AND expires_at > now()
          AND reward_type IN ('free_for_life','unlimited_ai')
      )
  END;
$function$;

CREATE OR REPLACE FUNCTION public.photo_template_quota(_user_id uuid)
 RETURNS TABLE(template_count integer, unlocked boolean, free_limit integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count INTEGER;
  v_unlocked BOOLEAN;
BEGIN
  IF _user_id IS NULL OR (_user_id <> auth.uid() AND NOT public.is_owner()) THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_count
  FROM public.photography_templates WHERE user_id = _user_id;

  SELECT EXISTS(
    SELECT 1 FROM public.app_unlocks
    WHERE user_id = _user_id AND app_key = 'photo_templates'
  ) OR public.has_role(_user_id, 'admin') INTO v_unlocked;

  RETURN QUERY SELECT v_count, v_unlocked, 5;
END;
$function$;