-- 1. Lock down public listing on shared buckets while keeping public file URLs working.
-- Public buckets bypass RLS for /object/public/{bucket}/{path} (direct URL access),
-- but listing endpoints (/object/list/{bucket}) require SELECT on storage.objects.
-- Removing the broad SELECT policies prevents anonymous users from enumerating files.

DROP POLICY IF EXISTS "Anyone can read photography assets" ON storage.objects;
DROP POLICY IF EXISTS "Living GIFs are publicly readable" ON storage.objects;
DROP POLICY IF EXISTS "Movies files are readable by URL" ON storage.objects;
DROP POLICY IF EXISTS "Public can download app files" ON storage.objects;

-- Owners and the file owner can still list/select (needed for management UIs).
CREATE POLICY "Owners list photography assets"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'photography-assets' AND ((auth.uid())::text = (storage.foldername(name))[1] OR public.is_owner()));

CREATE POLICY "Owners list living gifs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'living-gifs' AND ((auth.uid())::text = (storage.foldername(name))[1] OR public.is_owner()));

CREATE POLICY "Owners list movies"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'movies' AND ((auth.uid())::text = (storage.foldername(name))[1] OR public.is_owner()));

CREATE POLICY "Admin lists app downloads"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'app-downloads' AND public.is_owner());

-- 2. Add a column so each user can opt out of any forced/major brand watermark on exports.
ALTER TABLE public.user_brand_kits
  ADD COLUMN IF NOT EXISTS hide_brand_watermark boolean NOT NULL DEFAULT false;

-- 3. Allow the new homepage mailbox to write to inquiry_leads using source = 'mailbox'.
-- (Existing INSERT policy already permits any non-empty message; no change needed.)
-- Add an index on source for the admin tab filter.
CREATE INDEX IF NOT EXISTS idx_inquiry_leads_source_created
  ON public.inquiry_leads (source, created_at DESC);
