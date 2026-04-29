CREATE OR REPLACE FUNCTION public.library_media_type_from_url(_url text, _field text DEFAULT '')
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text := lower(coalesce(_url, ''));
  f text := lower(coalesce(_field, ''));
BEGIN
  IF v = '' THEN RETURN 'document'; END IF;
  IF f LIKE '%audio%' OR f LIKE '%music%' OR f LIKE '%sfx%' OR v LIKE 'data:audio/%' OR v ~ '\.(mp3|wav|m4a|ogg|aac)(\?|#|$)' THEN RETURN 'audio'; END IF;
  IF f LIKE '%video%' OR f LIKE '%mp4%' OR f LIKE '%trailer%' OR f LIKE '%scene%' OR v LIKE 'data:video/%' OR v ~ '\.(mp4|webm|mov|m4v)(\?|#|$)' THEN RETURN 'video'; END IF;
  IF f LIKE '%image%' OR f LIKE '%thumbnail%' OR f LIKE '%avatar%' OR f LIKE '%logo%' OR v LIKE 'data:image/%' OR v ~ '\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)' THEN RETURN 'image'; END IF;
  RETURN 'document';
END;
$$;

CREATE OR REPLACE FUNCTION public.save_library_item_for_user(
  _user_id uuid,
  _media_type text,
  _title text,
  _url text,
  _source_page text,
  _thumbnail_url text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _is_public boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_origin_table text := nullif(_metadata->>'origin_table', '');
  v_origin_id text := nullif(_metadata->>'origin_id', '');
  v_origin_field text := nullif(_metadata->>'origin_field', '');
  v_metadata jsonb := coalesce(_metadata, '{}'::jsonb) || jsonb_build_object('admin_library_visible', true, 'auto_saved', true, 'auto_saved_at', now());
BEGIN
  IF _user_id IS NULL OR coalesce(length(trim(_url)), 0) = 0 THEN RETURN NULL; END IF;

  IF v_origin_table IS NOT NULL AND v_origin_id IS NOT NULL AND v_origin_field IS NOT NULL THEN
    SELECT id INTO v_id FROM public.user_media
    WHERE user_id = _user_id AND metadata->>'origin_table' = v_origin_table AND metadata->>'origin_id' = v_origin_id AND metadata->>'origin_field' = v_origin_field
    ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.user_media WHERE user_id = _user_id AND url = _url ORDER BY created_at ASC LIMIT 1;
  END IF;

  IF v_id IS NOT NULL THEN
    UPDATE public.user_media
    SET media_type = coalesce(nullif(trim(_media_type), ''), media_type),
        title = coalesce(nullif(trim(_title), ''), title),
        thumbnail_url = coalesce(nullif(trim(coalesce(_thumbnail_url, '')), ''), thumbnail_url),
        source_page = coalesce(nullif(trim(coalesce(_source_page, '')), ''), source_page),
        metadata = coalesce(metadata, '{}'::jsonb) || v_metadata,
        updated_at = now()
    WHERE id = v_id;
    RETURN v_id;
  END IF;

  INSERT INTO public.user_media (user_id, media_type, title, url, thumbnail_url, source_page, metadata, is_public)
  VALUES (_user_id, coalesce(nullif(trim(_media_type), ''), public.library_media_type_from_url(_url, '')), nullif(trim(coalesce(_title, 'Untitled creation')), ''), _url, nullif(trim(coalesce(_thumbnail_url, '')), ''), nullif(trim(coalesce(_source_page, 'app')), ''), v_metadata, coalesce(_is_public, false))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_library_item(_media_type text, _title text, _url text, _source_page text, _thumbnail_url text DEFAULT NULL::text, _metadata jsonb DEFAULT '{}'::jsonb, _is_public boolean DEFAULT false)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  RETURN public.save_library_item_for_user(v_user, _media_type, _title, _url, _source_page, _thumbnail_url, coalesce(_metadata, '{}'::jsonb) || jsonb_build_object('saved_by', 'authenticated_user'), _is_public);
END;
$$;

CREATE OR REPLACE FUNCTION public.capture_library_from_known_asset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'movie_projects' THEN
    IF NEW.final_video_url IS NOT NULL AND length(trim(NEW.final_video_url)) > 0 THEN
      PERFORM public.save_library_item_for_user(NEW.user_id, 'video', coalesce(NEW.title, 'Movie') || ' — Final Movie', NEW.final_video_url, 'movie-studio', NEW.thumbnail_url, jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','final_video_url'), coalesce(NEW.is_public, false));
    END IF;
    IF NEW.thumbnail_url IS NOT NULL AND length(trim(NEW.thumbnail_url)) > 0 THEN
      PERFORM public.save_library_item_for_user(NEW.user_id, 'image', coalesce(NEW.title, 'Movie') || ' — Thumbnail', NEW.thumbnail_url, 'movie-studio', NEW.thumbnail_url, jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','thumbnail_url'), coalesce(NEW.is_public, false));
    END IF;
    IF NEW.trailer_url IS NOT NULL AND length(trim(NEW.trailer_url)) > 0 THEN
      PERFORM public.save_library_item_for_user(NEW.user_id, 'video', coalesce(NEW.title, 'Movie') || ' — Trailer', NEW.trailer_url, 'movie-studio', NEW.thumbnail_url, jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','trailer_url'), coalesce(NEW.is_public, false));
    END IF;
  ELSIF TG_TABLE_NAME = 'movie_scenes' THEN
    IF NEW.video_1080p_url IS NOT NULL AND length(trim(NEW.video_1080p_url)) > 0 THEN PERFORM public.save_library_item_for_user(NEW.user_id, 'video', 'Movie Scene ' || NEW.scene_number || ' — 1080p', NEW.video_1080p_url, 'movie-studio', NEW.video_1080p_url, jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','video_1080p_url','project_id',NEW.project_id::text), false); END IF;
    IF NEW.video_4k_url IS NOT NULL AND length(trim(NEW.video_4k_url)) > 0 THEN PERFORM public.save_library_item_for_user(NEW.user_id, 'video', 'Movie Scene ' || NEW.scene_number || ' — 4K', NEW.video_4k_url, 'movie-studio', NEW.video_4k_url, jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','video_4k_url','project_id',NEW.project_id::text), false); END IF;
    IF NEW.video_8k_url IS NOT NULL AND length(trim(NEW.video_8k_url)) > 0 THEN PERFORM public.save_library_item_for_user(NEW.user_id, 'video', 'Movie Scene ' || NEW.scene_number || ' — 8K', NEW.video_8k_url, 'movie-studio', NEW.video_8k_url, jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','video_8k_url','project_id',NEW.project_id::text), false); END IF;
    IF NEW.final_scene_url IS NOT NULL AND length(trim(NEW.final_scene_url)) > 0 THEN PERFORM public.save_library_item_for_user(NEW.user_id, 'video', 'Movie Scene ' || NEW.scene_number || ' — Final Scene', NEW.final_scene_url, 'movie-studio', NEW.final_scene_url, jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','final_scene_url','project_id',NEW.project_id::text), false); END IF;
    IF NEW.audio_url IS NOT NULL AND length(trim(NEW.audio_url)) > 0 THEN PERFORM public.save_library_item_for_user(NEW.user_id, 'audio', 'Movie Scene ' || NEW.scene_number || ' — Voice Audio', NEW.audio_url, 'movie-studio', NULL, jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','audio_url','project_id',NEW.project_id::text), false); END IF;
    IF NEW.music_url IS NOT NULL AND length(trim(NEW.music_url)) > 0 THEN PERFORM public.save_library_item_for_user(NEW.user_id, 'audio', 'Movie Scene ' || NEW.scene_number || ' — Music', NEW.music_url, 'movie-studio', NULL, jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','music_url','project_id',NEW.project_id::text), false); END IF;
    IF NEW.sfx_url IS NOT NULL AND length(trim(NEW.sfx_url)) > 0 THEN PERFORM public.save_library_item_for_user(NEW.user_id, 'audio', 'Movie Scene ' || NEW.scene_number || ' — Sound FX', NEW.sfx_url, 'movie-studio', NULL, jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','sfx_url','project_id',NEW.project_id::text), false); END IF;
    IF NEW.lipsync_url IS NOT NULL AND length(trim(NEW.lipsync_url)) > 0 THEN PERFORM public.save_library_item_for_user(NEW.user_id, 'video', 'Movie Scene ' || NEW.scene_number || ' — Lip Sync', NEW.lipsync_url, 'movie-studio', NEW.lipsync_url, jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','lipsync_url','project_id',NEW.project_id::text), false); END IF;
  ELSIF TG_TABLE_NAME = 'living_gifs' THEN
    IF NEW.source_image_url IS NOT NULL AND length(trim(NEW.source_image_url)) > 0 THEN PERFORM public.save_library_item_for_user(NEW.user_id, 'image', coalesce(NEW.title, 'Living Avatar') || ' — Source Image', NEW.source_image_url, 'living-avatars', NEW.thumbnail_url, jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','source_image_url'), false); END IF;
    IF NEW.gif_url IS NOT NULL AND length(trim(NEW.gif_url)) > 0 THEN PERFORM public.save_library_item_for_user(NEW.user_id, 'gif', coalesce(NEW.title, 'Living Avatar') || ' — Living GIF', NEW.gif_url, 'living-avatars', coalesce(NEW.thumbnail_url, NEW.source_image_url), jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','gif_url'), coalesce(NEW.is_public, false)); END IF;
    IF NEW.preview_mp4_url IS NOT NULL AND length(trim(NEW.preview_mp4_url)) > 0 THEN PERFORM public.save_library_item_for_user(NEW.user_id, 'video', coalesce(NEW.title, 'Living Avatar') || ' — Motion Preview', NEW.preview_mp4_url, 'living-avatars', coalesce(NEW.thumbnail_url, NEW.source_image_url), jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','preview_mp4_url'), coalesce(NEW.is_public, false)); END IF;
    IF NEW.thumbnail_url IS NOT NULL AND length(trim(NEW.thumbnail_url)) > 0 THEN PERFORM public.save_library_item_for_user(NEW.user_id, 'image', coalesce(NEW.title, 'Living Avatar') || ' — Thumbnail', NEW.thumbnail_url, 'living-avatars', NEW.thumbnail_url, jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','thumbnail_url'), coalesce(NEW.is_public, false)); END IF;
  ELSIF TG_TABLE_NAME = 'user_avatars' THEN
    IF NEW.image_url IS NOT NULL AND length(trim(NEW.image_url)) > 0 THEN PERFORM public.save_library_item_for_user(NEW.user_id, 'image', coalesce(NEW.name, 'Avatar'), NEW.image_url, 'avatar-generator', NEW.image_url, jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','image_url','purpose',NEW.purpose), false); END IF;
  ELSIF TG_TABLE_NAME = 'photography_templates' THEN
    IF NEW.thumbnail_url IS NOT NULL AND length(trim(NEW.thumbnail_url)) > 0 THEN PERFORM public.save_library_item_for_user(NEW.user_id, 'image', coalesce(NEW.name, 'Photography Template'), NEW.thumbnail_url, 'photography-hub', NEW.thumbnail_url, jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','thumbnail_url','prompt',NEW.prompt), false); END IF;
  ELSIF TG_TABLE_NAME = 'movie_character_bible' THEN
    IF NEW.reference_image_url IS NOT NULL AND length(trim(NEW.reference_image_url)) > 0 THEN PERFORM public.save_library_item_for_user(NEW.user_id, 'image', coalesce(NEW.name, 'Movie Character') || ' — Reference', NEW.reference_image_url, 'movie-studio', NEW.reference_image_url, jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','reference_image_url','project_id',NEW.project_id::text), false); END IF;
  ELSIF TG_TABLE_NAME = 'user_brand_kits' THEN
    IF NEW.logo_url IS NOT NULL AND length(trim(NEW.logo_url)) > 0 THEN PERFORM public.save_library_item_for_user(NEW.user_id, 'image', coalesce(NEW.brand_name, 'Brand Kit') || ' — Logo', NEW.logo_url, 'photography-hub', NEW.logo_url, jsonb_build_object('origin_table',TG_TABLE_NAME,'origin_id',NEW.id::text,'origin_field','logo_url','brand_name',NEW.brand_name), false); END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS capture_library_movie_projects ON public.movie_projects;
CREATE TRIGGER capture_library_movie_projects AFTER INSERT OR UPDATE OF final_video_url, thumbnail_url, trailer_url, title, is_public ON public.movie_projects FOR EACH ROW EXECUTE FUNCTION public.capture_library_from_known_asset();
DROP TRIGGER IF EXISTS capture_library_movie_scenes ON public.movie_scenes;
CREATE TRIGGER capture_library_movie_scenes AFTER INSERT OR UPDATE OF video_1080p_url, video_4k_url, video_8k_url, final_scene_url, audio_url, music_url, sfx_url, lipsync_url, scene_number ON public.movie_scenes FOR EACH ROW EXECUTE FUNCTION public.capture_library_from_known_asset();
DROP TRIGGER IF EXISTS capture_library_living_gifs ON public.living_gifs;
CREATE TRIGGER capture_library_living_gifs AFTER INSERT OR UPDATE OF source_image_url, gif_url, preview_mp4_url, thumbnail_url, title, is_public ON public.living_gifs FOR EACH ROW EXECUTE FUNCTION public.capture_library_from_known_asset();
DROP TRIGGER IF EXISTS capture_library_user_avatars ON public.user_avatars;
CREATE TRIGGER capture_library_user_avatars AFTER INSERT OR UPDATE OF image_url, name, purpose ON public.user_avatars FOR EACH ROW EXECUTE FUNCTION public.capture_library_from_known_asset();
DROP TRIGGER IF EXISTS capture_library_photo_templates ON public.photography_templates;
CREATE TRIGGER capture_library_photo_templates AFTER INSERT OR UPDATE OF thumbnail_url, name, prompt ON public.photography_templates FOR EACH ROW EXECUTE FUNCTION public.capture_library_from_known_asset();
DROP TRIGGER IF EXISTS capture_library_character_bible ON public.movie_character_bible;
CREATE TRIGGER capture_library_character_bible AFTER INSERT OR UPDATE OF reference_image_url, name ON public.movie_character_bible FOR EACH ROW EXECUTE FUNCTION public.capture_library_from_known_asset();
DROP TRIGGER IF EXISTS capture_library_brand_kits ON public.user_brand_kits;
CREATE TRIGGER capture_library_brand_kits AFTER INSERT OR UPDATE OF logo_url, brand_name ON public.user_brand_kits FOR EACH ROW EXECUTE FUNCTION public.capture_library_from_known_asset();