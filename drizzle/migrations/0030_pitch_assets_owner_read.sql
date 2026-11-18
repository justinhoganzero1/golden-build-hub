CREATE POLICY "Owner reads pitch assets" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'pitch-assets' AND public.has_role(auth.uid(), 'admin'));