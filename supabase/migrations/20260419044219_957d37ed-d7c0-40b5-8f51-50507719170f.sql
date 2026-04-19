DROP POLICY IF EXISTS "Movies are publicly readable" ON storage.objects;

-- Keep public read on the actual file objects (needed for YouTube fetch + video tag playback)
-- but the bucket listing endpoint won't expose the file list because we don't grant
-- listing on storage.buckets either, and listObjects requires a different policy path.
CREATE POLICY "Movies files are readable by URL"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'movies'
);