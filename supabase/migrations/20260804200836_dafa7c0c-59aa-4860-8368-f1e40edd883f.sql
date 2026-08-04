DROP VIEW IF EXISTS public.public_stories;

CREATE VIEW public.public_stories AS
SELECT id,
       title,
       COALESCE(metadata->>'slug', replace(id::text, '-', '')) AS slug,
       metadata->>'genre'      AS genre,
       COALESCE(NULLIF(metadata->>'blurb',''), metadata->>'premise') AS premise,
       COALESCE(NULLIF(metadata->>'author',''), metadata->>'authorName') AS author_name,
       metadata->>'coverImage' AS cover_image,
       CASE WHEN jsonb_typeof(metadata->'chapters') = 'array'
            THEN metadata->'chapters' ELSE '[]'::jsonb END AS chapters,
       updated_at, created_at
FROM public.user_media
WHERE is_public = true
  AND (media_type = 'story' OR (media_type = 'document' AND source_page = 'story-writer'));

GRANT SELECT ON public.public_stories TO anon, authenticated;