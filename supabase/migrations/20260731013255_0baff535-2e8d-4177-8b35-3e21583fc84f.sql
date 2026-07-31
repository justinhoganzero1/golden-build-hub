GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_media TO authenticated;
GRANT ALL ON public.user_media TO service_role;

CREATE OR REPLACE FUNCTION public.save_story_writer_document(
  _story_id uuid,
  _title text,
  _metadata jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_existing jsonb;
  v_incoming jsonb := coalesce(_metadata, '{}'::jsonb);
  v_old_chapters jsonb;
  v_new_chapters jsonb;
  v_merged_chapters jsonb;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT metadata INTO v_existing
  FROM public.user_media
  WHERE id = _story_id
    AND user_id = v_user
    AND media_type = 'story'
    AND source_page = 'story-writer'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'story not found or access denied';
  END IF;

  v_existing := coalesce(v_existing, '{}'::jsonb);
  v_old_chapters := coalesce(v_existing->'chapters', '[]'::jsonb);
  v_new_chapters := coalesce(v_incoming->'chapters', '[]'::jsonb);

  SELECT coalesce(jsonb_agg(
    CASE
      WHEN jsonb_typeof(n.chapter) = 'object'
       AND NOT (n.chapter ? 'images')
       AND jsonb_typeof(o.chapter) = 'object'
       AND o.chapter ? 'images'
      THEN n.chapter || jsonb_build_object('images', o.chapter->'images')
      ELSE n.chapter
    END
    ORDER BY n.ordinality
  ), '[]'::jsonb)
  INTO v_merged_chapters
  FROM jsonb_array_elements(v_new_chapters) WITH ORDINALITY AS n(chapter, ordinality)
  LEFT JOIN jsonb_array_elements(v_old_chapters) WITH ORDINALITY AS o(chapter, ordinality)
    ON o.ordinality = n.ordinality;

  v_incoming := v_incoming || jsonb_build_object('chapters', v_merged_chapters);

  IF NOT (v_incoming ? 'coverImage') AND v_existing ? 'coverImage' THEN
    v_incoming := v_incoming || jsonb_build_object('coverImage', v_existing->'coverImage');
  END IF;
  IF NOT (v_incoming ? 'backImage') AND v_existing ? 'backImage' THEN
    v_incoming := v_incoming || jsonb_build_object('backImage', v_existing->'backImage');
  END IF;

  UPDATE public.user_media
  SET title = coalesce(nullif(trim(_title), ''), title),
      metadata = v_existing || v_incoming || jsonb_build_object(
        'admin_library_visible', true,
        'kind', 'story_doc',
        'auto_saved', true,
        'auto_saved_at', now()
      ),
      updated_at = now()
  WHERE id = _story_id;

  RETURN _story_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_story_writer_document(uuid, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_story_writer_document(uuid, text, jsonb) TO authenticated, service_role;