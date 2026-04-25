-- Backend helper to save a creation directly into the member library
CREATE OR REPLACE FUNCTION public.save_library_item(
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
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF COALESCE(length(trim(_url)), 0) = 0 THEN
    RAISE EXCEPTION 'library item requires content';
  END IF;

  INSERT INTO public.user_media (
    user_id,
    media_type,
    title,
    url,
    thumbnail_url,
    source_page,
    metadata,
    is_public
  ) VALUES (
    v_user,
    COALESCE(NULLIF(trim(_media_type), ''), 'document'),
    NULLIF(trim(COALESCE(_title, 'Untitled creation')), ''),
    _url,
    NULLIF(trim(COALESCE(_thumbnail_url, '')), ''),
    NULLIF(trim(COALESCE(_source_page, 'app')), ''),
    COALESCE(_metadata, '{}'::jsonb),
    COALESCE(_is_public, false)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.save_library_item(text, text, text, text, text, jsonb, boolean) TO authenticated;

-- Ensure direct table access still supports signed-in members and owner/admin library views
DROP POLICY IF EXISTS "Users can create own media" ON public.user_media;
CREATE POLICY "Users can create own media"
ON public.user_media
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own media" ON public.user_media;
CREATE POLICY "Users can view own media"
ON public.user_media
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own media" ON public.user_media;
CREATE POLICY "Users can update own media"
ON public.user_media
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own media" ON public.user_media;
CREATE POLICY "Users can delete own media"
ON public.user_media
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Owner can view all media" ON public.user_media;
CREATE POLICY "Owner can view all media"
ON public.user_media
FOR SELECT
TO authenticated
USING (public.is_owner());