DROP POLICY IF EXISTS "Anyone signed in can read limits" ON public.ai_usage_limits;

DROP POLICY IF EXISTS "Anyone can read global signatures" ON public.global_sound_signatures;
CREATE POLICY "Members can read global signatures" ON public.global_sound_signatures
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Read own or public photography assets" ON storage.objects;
DROP POLICY IF EXISTS "Read own or public movie files" ON storage.objects;
DROP POLICY IF EXISTS "Read own or public living gif files" ON storage.objects;

CREATE POLICY "Read own photography assets" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'photography-assets' AND (storage.foldername(name))[1] = (select auth.uid()::text));
CREATE POLICY "Read shared photography assets" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'photography-assets' AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_media m WHERE m.is_public = true
      AND (m.url LIKE '%/photography-assets/' || objects.name OR m.thumbnail_url LIKE '%/photography-assets/' || objects.name)));

CREATE POLICY "Read own movie files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'movies' AND (storage.foldername(name))[1] = (select auth.uid()::text));
CREATE POLICY "Read shared movie files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'movies' AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.movie_projects mp WHERE mp.is_public = true
      AND (mp.final_video_url LIKE '%/movies/' || objects.name OR mp.trailer_url LIKE '%/movies/' || objects.name OR mp.thumbnail_url LIKE '%/movies/' || objects.name)));

CREATE POLICY "Read own living gif files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'living-gifs' AND (storage.foldername(name))[1] = (select auth.uid()::text));
CREATE POLICY "Read shared living gif files" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'living-gifs' AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.living_gifs g WHERE g.is_public = true
      AND (g.gif_url LIKE '%/living-gifs/' || objects.name OR g.preview_mp4_url LIKE '%/living-gifs/' || objects.name OR g.thumbnail_url LIKE '%/living-gifs/' || objects.name)));