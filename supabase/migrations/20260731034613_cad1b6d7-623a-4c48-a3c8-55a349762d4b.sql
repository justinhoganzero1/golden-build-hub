CREATE OR REPLACE FUNCTION public.get_story_writer_document(_story_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.get_story_writer_images(_story_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.get_story_writer_images(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_story_writer_images(uuid) TO authenticated, service_role;