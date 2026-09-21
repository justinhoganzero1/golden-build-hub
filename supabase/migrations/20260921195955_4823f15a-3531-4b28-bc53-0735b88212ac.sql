CREATE OR REPLACE FUNCTION public.get_book_page(_story_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'id', um.id,
    'title', coalesce(um.title, ''),
    'author', coalesce(um.metadata->>'author', um.metadata->>'authorName', ''),
    'genre', coalesce(um.metadata->>'genre', ''),
    'blurb', coalesce(um.metadata->>'blurb', ''),
    'premise', coalesce(um.metadata->>'premise', ''),
    'dedication', coalesce(um.metadata->>'dedication', ''),
    'coverImage', CASE WHEN length(coalesce(um.metadata->>'coverImage','')) < 200000 THEN um.metadata->>'coverImage' ELSE NULL END,
    'backImage', CASE WHEN length(coalesce(um.metadata->>'backImage','')) < 200000 THEN um.metadata->>'backImage' ELSE NULL END,
    'chapters', coalesce((
      SELECT jsonb_agg(
        jsonb_build_object(
          'title', coalesce(chapter->>'title', 'Chapter ' || ordinality::text),
          'summary', coalesce(um.metadata->'chapterSummaries'->>(ordinality::int - 1), ''),
          'words', array_length(regexp_split_to_array(trim(coalesce(chapter->>'content','')), '\s+'), 1),
          'images', coalesce(jsonb_array_length(CASE WHEN jsonb_typeof(chapter->'images')='array' THEN chapter->'images' ELSE '[]'::jsonb END), 0)
        ) ORDER BY ordinality
      )
      FROM jsonb_array_elements(coalesce(um.metadata->'chapters','[]'::jsonb)) WITH ORDINALITY AS c(chapter, ordinality)
    ), '[]'::jsonb)
  )
  FROM public.user_media um
  WHERE um.id = _story_id
    AND um.media_type = 'story'
    AND (um.user_id = auth.uid() OR public.is_owner() OR um.is_public = true)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_book_page(uuid) TO authenticated, anon;