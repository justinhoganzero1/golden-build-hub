
-- Create public storage bucket for the Android app installer
INSERT INTO storage.buckets (id, name, public)
VALUES ('app-downloads', 'app-downloads', true)
ON CONFLICT (id) DO NOTHING;

-- Public can read (download) files in this bucket
CREATE POLICY "Public can download app files"
ON storage.objects FOR SELECT
USING (bucket_id = 'app-downloads');

-- Only admins can upload/replace app installers
CREATE POLICY "Admins can upload app files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'app-downloads' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update app files"
ON storage.objects FOR UPDATE
USING (bucket_id = 'app-downloads' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete app files"
ON storage.objects FOR DELETE
USING (bucket_id = 'app-downloads' AND public.has_role(auth.uid(), 'admin'));
