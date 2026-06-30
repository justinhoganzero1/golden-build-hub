
-- 1) Storage policies still on {public} role → authenticated
ALTER POLICY "Admins can upload app files"      ON storage.objects TO authenticated;
ALTER POLICY "Users upload to own movie folder" ON storage.objects TO authenticated;

-- 2) Private-bucket SELECT policies (owner OR linked record is public)
DROP POLICY IF EXISTS "Read own or public movie files"        ON storage.objects;
DROP POLICY IF EXISTS "Read own or public living gif files"   ON storage.objects;
DROP POLICY IF EXISTS "Read own or public photography assets" ON storage.objects;

CREATE POLICY "Read own or public movie files" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'movies' AND (
      (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
      OR EXISTS (
        SELECT 1 FROM public.movie_projects mp
        WHERE mp.is_public = true
          AND (mp.final_video_url LIKE '%' || storage.objects.name
               OR mp.trailer_url   LIKE '%' || storage.objects.name
               OR mp.thumbnail_url LIKE '%' || storage.objects.name)
      )
    )
  );

CREATE POLICY "Read own or public living gif files" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'living-gifs' AND (
      (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
      OR EXISTS (
        SELECT 1 FROM public.living_gifs g
        WHERE g.is_public = true
          AND (g.gif_url          LIKE '%' || storage.objects.name
               OR g.preview_mp4_url LIKE '%' || storage.objects.name
               OR g.thumbnail_url   LIKE '%' || storage.objects.name
               OR g.source_image_url LIKE '%' || storage.objects.name)
      )
    )
  );

CREATE POLICY "Read own or public photography assets" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'photography-assets' AND (
      (auth.uid() IS NOT NULL AND (storage.foldername(name))[1] = auth.uid()::text)
      OR EXISTS (
        SELECT 1 FROM public.user_media m
        WHERE m.is_public = true
          AND (m.url           LIKE '%' || storage.objects.name
               OR m.thumbnail_url LIKE '%' || storage.objects.name)
      )
    )
  );

-- 3) affiliate_clicks: drop the WITH CHECK(true), require user_id = caller or NULL
DROP POLICY IF EXISTS "members record affiliate clicks" ON public.affiliate_clicks;
CREATE POLICY "members record affiliate clicks"
  ON public.affiliate_clicks FOR INSERT TO authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- 4) Revoke EXECUTE on internal trigger functions from anon + authenticated
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
      AND pg_get_function_result(p.oid) = 'trigger'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, authenticated, public',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;
