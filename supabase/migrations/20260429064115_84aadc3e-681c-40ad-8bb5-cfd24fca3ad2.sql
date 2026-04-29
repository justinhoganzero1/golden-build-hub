-- Backfill existing generated assets into the unified My Library table.
-- This uses the existing secure helper, which de-duplicates by origin metadata or URL.
SELECT public.save_library_item_for_user(
  user_id,
  'video',
  coalesce(title, 'Movie') || ' — Final Movie',
  final_video_url,
  'movie-studio',
  thumbnail_url,
  jsonb_build_object('origin_table','movie_projects','origin_id',id::text,'origin_field','final_video_url'),
  coalesce(is_public, false)
)
FROM public.movie_projects
WHERE final_video_url IS NOT NULL AND length(trim(final_video_url)) > 0;

SELECT public.save_library_item_for_user(
  user_id,
  'image',
  coalesce(title, 'Movie') || ' — Thumbnail',
  thumbnail_url,
  'movie-studio',
  thumbnail_url,
  jsonb_build_object('origin_table','movie_projects','origin_id',id::text,'origin_field','thumbnail_url'),
  coalesce(is_public, false)
)
FROM public.movie_projects
WHERE thumbnail_url IS NOT NULL AND length(trim(thumbnail_url)) > 0;

SELECT public.save_library_item_for_user(
  user_id,
  'video',
  coalesce(title, 'Movie') || ' — Trailer',
  trailer_url,
  'movie-studio',
  thumbnail_url,
  jsonb_build_object('origin_table','movie_projects','origin_id',id::text,'origin_field','trailer_url'),
  coalesce(is_public, false)
)
FROM public.movie_projects
WHERE trailer_url IS NOT NULL AND length(trim(trailer_url)) > 0;

SELECT public.save_library_item_for_user(
  user_id,
  public.library_media_type_from_url(asset_url, asset_field),
  title,
  asset_url,
  'movie-studio',
  CASE WHEN public.library_media_type_from_url(asset_url, asset_field) = 'audio' THEN NULL ELSE asset_url END,
  jsonb_build_object('origin_table','movie_scenes','origin_id',scene_id::text,'origin_field',asset_field,'project_id',project_id::text),
  false
)
FROM (
  SELECT id AS scene_id, user_id, project_id, 'video_1080p_url' AS asset_field, 'Movie Scene ' || scene_number || ' — 1080p' AS title, video_1080p_url AS asset_url FROM public.movie_scenes
  UNION ALL SELECT id, user_id, project_id, 'video_4k_url', 'Movie Scene ' || scene_number || ' — 4K', video_4k_url FROM public.movie_scenes
  UNION ALL SELECT id, user_id, project_id, 'video_8k_url', 'Movie Scene ' || scene_number || ' — 8K', video_8k_url FROM public.movie_scenes
  UNION ALL SELECT id, user_id, project_id, 'final_scene_url', 'Movie Scene ' || scene_number || ' — Final Scene', final_scene_url FROM public.movie_scenes
  UNION ALL SELECT id, user_id, project_id, 'audio_url', 'Movie Scene ' || scene_number || ' — Voice Audio', audio_url FROM public.movie_scenes
  UNION ALL SELECT id, user_id, project_id, 'music_url', 'Movie Scene ' || scene_number || ' — Music', music_url FROM public.movie_scenes
  UNION ALL SELECT id, user_id, project_id, 'sfx_url', 'Movie Scene ' || scene_number || ' — Sound FX', sfx_url FROM public.movie_scenes
  UNION ALL SELECT id, user_id, project_id, 'lipsync_url', 'Movie Scene ' || scene_number || ' — Lip Sync', lipsync_url FROM public.movie_scenes
) scene_assets
WHERE asset_url IS NOT NULL AND length(trim(asset_url)) > 0;

SELECT public.save_library_item_for_user(
  user_id,
  public.library_media_type_from_url(asset_url, asset_field),
  title,
  asset_url,
  'living-avatars',
  coalesce(thumbnail_url, fallback_thumbnail),
  jsonb_build_object('origin_table','living_gifs','origin_id',gif_id::text,'origin_field',asset_field),
  coalesce(is_public, false)
)
FROM (
  SELECT id AS gif_id, user_id, is_public, thumbnail_url, source_image_url AS fallback_thumbnail, 'source_image_url' AS asset_field, coalesce(title, 'Living Avatar') || ' — Source Image' AS title, source_image_url AS asset_url FROM public.living_gifs
  UNION ALL SELECT id, user_id, is_public, thumbnail_url, source_image_url, 'gif_url', coalesce(title, 'Living Avatar') || ' — Living GIF', gif_url FROM public.living_gifs
  UNION ALL SELECT id, user_id, is_public, thumbnail_url, source_image_url, 'preview_mp4_url', coalesce(title, 'Living Avatar') || ' — Motion Preview', preview_mp4_url FROM public.living_gifs
  UNION ALL SELECT id, user_id, is_public, thumbnail_url, source_image_url, 'thumbnail_url', coalesce(title, 'Living Avatar') || ' — Thumbnail', thumbnail_url FROM public.living_gifs
) gif_assets
WHERE asset_url IS NOT NULL AND length(trim(asset_url)) > 0;

SELECT public.save_library_item_for_user(
  user_id,
  'image',
  coalesce(name, 'Avatar'),
  image_url,
  'avatar-generator',
  image_url,
  jsonb_build_object('origin_table','user_avatars','origin_id',id::text,'origin_field','image_url','purpose',purpose),
  false
)
FROM public.user_avatars
WHERE image_url IS NOT NULL AND length(trim(image_url)) > 0;

SELECT public.save_library_item_for_user(
  user_id,
  'image',
  coalesce(name, 'Photography Template'),
  thumbnail_url,
  'photography-hub',
  thumbnail_url,
  jsonb_build_object('origin_table','photography_templates','origin_id',id::text,'origin_field','thumbnail_url','prompt',prompt),
  false
)
FROM public.photography_templates
WHERE thumbnail_url IS NOT NULL AND length(trim(thumbnail_url)) > 0;

SELECT public.save_library_item_for_user(
  user_id,
  'image',
  coalesce(name, 'Movie Character') || ' — Reference',
  reference_image_url,
  'movie-studio',
  reference_image_url,
  jsonb_build_object('origin_table','movie_character_bible','origin_id',id::text,'origin_field','reference_image_url','project_id',project_id::text),
  false
)
FROM public.movie_character_bible
WHERE reference_image_url IS NOT NULL AND length(trim(reference_image_url)) > 0;

SELECT public.save_library_item_for_user(
  user_id,
  'image',
  coalesce(brand_name, 'Brand Kit') || ' — Logo',
  logo_url,
  'photography-hub',
  logo_url,
  jsonb_build_object('origin_table','user_brand_kits','origin_id',id::text,'origin_field','logo_url','brand_name',brand_name),
  false
)
FROM public.user_brand_kits
WHERE logo_url IS NOT NULL AND length(trim(logo_url)) > 0;