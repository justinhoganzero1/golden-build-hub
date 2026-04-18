DROP POLICY IF EXISTS "Anyone can read page views" ON public.page_views;

CREATE POLICY "Owner can read page views"
  ON public.page_views FOR SELECT
  TO authenticated
  USING (public.is_owner());