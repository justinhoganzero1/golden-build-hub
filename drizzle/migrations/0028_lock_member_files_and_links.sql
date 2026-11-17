-- Shared files: only readable when the file's own uploader marked their item public
DROP POLICY IF EXISTS "Read shared living gif files" ON storage.objects;
CREATE POLICY "Read shared living gif files" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'living-gifs' AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.living_gifs g
    WHERE g.is_public = true
      AND g.user_id::text = (storage.foldername(objects.name))[1]
      AND (g.gif_url LIKE ('%/living-gifs/' || objects.name)
        OR g.preview_mp4_url LIKE ('%/living-gifs/' || objects.name)
        OR g.thumbnail_url LIKE ('%/living-gifs/' || objects.name))
  )
);

DROP POLICY IF EXISTS "Read shared movie files" ON storage.objects;
CREATE POLICY "Read shared movie files" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'movies' AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.movie_projects mp
    WHERE mp.is_public = true
      AND mp.user_id::text = (storage.foldername(objects.name))[1]
      AND (mp.final_video_url LIKE ('%/movies/' || objects.name)
        OR mp.trailer_url LIKE ('%/movies/' || objects.name)
        OR mp.thumbnail_url LIKE ('%/movies/' || objects.name))
  )
);

DROP POLICY IF EXISTS "Read shared photography assets" ON storage.objects;
CREATE POLICY "Read shared photography assets" ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'photography-assets' AND auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_media m
    WHERE m.is_public = true
      AND m.user_id::text = (storage.foldername(objects.name))[1]
      AND (m.url LIKE ('%/photography-assets/' || objects.name)
        OR m.thumbnail_url LIKE ('%/photography-assets/' || objects.name))
  )
);

-- Amazon links: own links, or links on books the author made public
DROP POLICY IF EXISTS "Members can view Amazon links" ON public.book_amazon_links;
CREATE POLICY "Authors and readers of public books view Amazon links" ON public.book_amazon_links FOR SELECT TO authenticated
USING (
  auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM public.user_media m
    WHERE m.id = book_amazon_links.story_id AND m.is_public = true AND m.user_id = book_amazon_links.user_id
  )
);

-- Announcements: visitors only see the live one
DROP POLICY IF EXISTS "Anyone can read announcements" ON public.site_announcements;
CREATE POLICY "Anyone can read active announcements" ON public.site_announcements FOR SELECT TO anon, authenticated
USING (active = true);