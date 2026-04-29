DROP TRIGGER IF EXISTS capture_library_movie_projects ON public.movie_projects;
DROP TRIGGER IF EXISTS capture_library_movie_scenes ON public.movie_scenes;
DROP TRIGGER IF EXISTS capture_library_living_gifs ON public.living_gifs;
DROP TRIGGER IF EXISTS capture_library_user_avatars ON public.user_avatars;
DROP TRIGGER IF EXISTS capture_library_photography_templates ON public.photography_templates;
DROP TRIGGER IF EXISTS capture_library_movie_character_bible ON public.movie_character_bible;
DROP TRIGGER IF EXISTS capture_library_user_brand_kits ON public.user_brand_kits;

CREATE TRIGGER capture_library_movie_projects
AFTER INSERT OR UPDATE OF final_video_url, thumbnail_url, trailer_url
ON public.movie_projects
FOR EACH ROW
EXECUTE FUNCTION public.capture_library_from_known_asset();

CREATE TRIGGER capture_library_movie_scenes
AFTER INSERT OR UPDATE OF video_1080p_url, video_4k_url, video_8k_url, audio_url, music_url, sfx_url, lipsync_url, final_scene_url
ON public.movie_scenes
FOR EACH ROW
EXECUTE FUNCTION public.capture_library_from_known_asset();

CREATE TRIGGER capture_library_living_gifs
AFTER INSERT OR UPDATE OF source_image_url, gif_url, preview_mp4_url, thumbnail_url
ON public.living_gifs
FOR EACH ROW
EXECUTE FUNCTION public.capture_library_from_known_asset();

CREATE TRIGGER capture_library_user_avatars
AFTER INSERT OR UPDATE OF image_url
ON public.user_avatars
FOR EACH ROW
EXECUTE FUNCTION public.capture_library_from_known_asset();

CREATE TRIGGER capture_library_photography_templates
AFTER INSERT OR UPDATE OF thumbnail_url
ON public.photography_templates
FOR EACH ROW
EXECUTE FUNCTION public.capture_library_from_known_asset();

CREATE TRIGGER capture_library_movie_character_bible
AFTER INSERT OR UPDATE OF reference_image_url
ON public.movie_character_bible
FOR EACH ROW
EXECUTE FUNCTION public.capture_library_from_known_asset();

CREATE TRIGGER capture_library_user_brand_kits
AFTER INSERT OR UPDATE OF logo_url
ON public.user_brand_kits
FOR EACH ROW
EXECUTE FUNCTION public.capture_library_from_known_asset();