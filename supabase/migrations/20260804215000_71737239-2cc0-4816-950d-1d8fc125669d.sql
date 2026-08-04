DROP POLICY IF EXISTS "Admins can update featured photos" ON public.featured_photos;
CREATE POLICY "Admins can update featured photos"
ON public.featured_photos FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));