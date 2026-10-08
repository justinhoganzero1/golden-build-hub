CREATE OR REPLACE FUNCTION public.save_story_chapter_text(
  _story_id uuid,
  _chapter_number integer,
  _title text,
  _content text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_meta jsonb;
  v_chapters jsonb;
  v_len integer;
  v_idx integer := _chapter_number - 1;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF _chapter_number IS NULL OR _chapter_number < 1 THEN RAISE EXCEPTION 'invalid chapter number'; END IF;
  IF coalesce(trim(_title), '') = '' OR coalesce(trim(_content), '') = '' THEN RAISE EXCEPTION 'title and content are required'; END IF;

  SELECT metadata INTO v_meta FROM public.user_media
  WHERE id = _story_id AND user_id = v_user AND media_type = 'story' AND source_page = 'story-writer'
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'story not found or access denied'; END IF;

  v_meta := coalesce(v_meta, '{}'::jsonb);
  v_chapters := coalesce(v_meta->'chapters', '[]'::jsonb);
  v_len := jsonb_array_length(v_chapters);

  IF _chapter_number > v_len + 1 THEN
    RAISE EXCEPTION 'book has % chapters; use % to add a new one', v_len, v_len + 1;
  ELSIF _chapter_number = v_len + 1 THEN
    v_chapters := v_chapters || jsonb_build_array(jsonb_build_object('title', _title, 'content', _content));
  ELSE
    -- Only title and content change; images, anchors and every other chapter key stay.
    v_chapters := jsonb_set(v_chapters, ARRAY[v_idx::text],
      coalesce(v_chapters->v_idx, '{}'::jsonb) || jsonb_build_object('title', _title, 'content', _content));
  END IF;

  UPDATE public.user_media
  SET metadata = v_meta || jsonb_build_object('chapters', v_chapters, 'auto_saved', true, 'auto_saved_at', now()),
      updated_at = now()
  WHERE id = _story_id;

  RETURN jsonb_array_length(v_chapters);
END;
$$;

REVOKE ALL ON FUNCTION public.save_story_chapter_text(uuid, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_story_chapter_text(uuid, integer, text, text) TO authenticated, service_role;