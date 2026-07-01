
-- Attach the capture_library_from_known_asset function as AFTER INSERT/UPDATE triggers
-- on every creation table so finished assets auto-populate My Library.

DROP TRIGGER IF EXISTS trg_capture_library_movie_projects ON public.movie_projects;
CREATE TRIGGER trg_capture_library_movie_projects
  AFTER INSERT OR UPDATE ON public.movie_projects
  FOR EACH ROW EXECUTE FUNCTION public.capture_library_from_known_asset();

DROP TRIGGER IF EXISTS trg_capture_library_movie_scenes ON public.movie_scenes;
CREATE TRIGGER trg_capture_library_movie_scenes
  AFTER INSERT OR UPDATE ON public.movie_scenes
  FOR EACH ROW EXECUTE FUNCTION public.capture_library_from_known_asset();

DROP TRIGGER IF EXISTS trg_capture_library_living_gifs ON public.living_gifs;
CREATE TRIGGER trg_capture_library_living_gifs
  AFTER INSERT OR UPDATE ON public.living_gifs
  FOR EACH ROW EXECUTE FUNCTION public.capture_library_from_known_asset();

DROP TRIGGER IF EXISTS trg_capture_library_user_avatars ON public.user_avatars;
CREATE TRIGGER trg_capture_library_user_avatars
  AFTER INSERT OR UPDATE ON public.user_avatars
  FOR EACH ROW EXECUTE FUNCTION public.capture_library_from_known_asset();

DROP TRIGGER IF EXISTS trg_capture_library_photography_templates ON public.photography_templates;
CREATE TRIGGER trg_capture_library_photography_templates
  AFTER INSERT OR UPDATE ON public.photography_templates
  FOR EACH ROW EXECUTE FUNCTION public.capture_library_from_known_asset();

DROP TRIGGER IF EXISTS trg_capture_library_movie_character_bible ON public.movie_character_bible;
CREATE TRIGGER trg_capture_library_movie_character_bible
  AFTER INSERT OR UPDATE ON public.movie_character_bible
  FOR EACH ROW EXECUTE FUNCTION public.capture_library_from_known_asset();

DROP TRIGGER IF EXISTS trg_capture_library_user_brand_kits ON public.user_brand_kits;
CREATE TRIGGER trg_capture_library_user_brand_kits
  AFTER INSERT OR UPDATE ON public.user_brand_kits
  FOR EACH ROW EXECUTE FUNCTION public.capture_library_from_known_asset();

-- Backfill existing rows so anything you've already created shows up immediately.
UPDATE public.movie_projects SET updated_at = updated_at WHERE final_video_url IS NOT NULL OR thumbnail_url IS NOT NULL OR trailer_url IS NOT NULL;
UPDATE public.movie_scenes SET updated_at = updated_at;
UPDATE public.living_gifs SET updated_at = updated_at;
UPDATE public.user_avatars SET updated_at = updated_at WHERE image_url IS NOT NULL;
UPDATE public.photography_templates SET updated_at = updated_at WHERE thumbnail_url IS NOT NULL;
UPDATE public.movie_character_bible SET updated_at = updated_at WHERE reference_image_url IS NOT NULL;
UPDATE public.user_brand_kits SET updated_at = updated_at WHERE logo_url IS NOT NULL;
