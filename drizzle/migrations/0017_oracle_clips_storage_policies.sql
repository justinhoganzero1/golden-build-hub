CREATE POLICY "Members read oracle clips" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'oracle-clips' AND public.is_active_member(auth.uid()));
CREATE POLICY "Owner uploads oracle clips" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'oracle-clips' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Owner updates oracle clips" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'oracle-clips' AND public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Owner deletes oracle clips" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'oracle-clips' AND public.has_role(auth.uid(), 'admin'::public.app_role));