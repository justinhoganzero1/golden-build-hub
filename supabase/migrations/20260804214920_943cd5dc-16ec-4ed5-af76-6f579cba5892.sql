-- 1) featured_photos: enforce attribution integrity
DROP POLICY IF EXISTS "Admins can insert featured photos" ON public.featured_photos;
CREATE POLICY "Admins can insert featured photos"
ON public.featured_photos FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Admins can update featured photos" ON public.featured_photos;
CREATE POLICY "Admins can update featured photos"
ON public.featured_photos FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND created_by = auth.uid());

DROP POLICY IF EXISTS "Admins can delete featured photos" ON public.featured_photos;
CREATE POLICY "Admins can delete featured photos"
ON public.featured_photos FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can view all featured photos" ON public.featured_photos;
CREATE POLICY "Admins can view all featured photos"
ON public.featured_photos FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2) movie_render_jobs: explicit DELETE policy + scoped UPDATE with WITH CHECK
DROP POLICY IF EXISTS "Service updates jobs" ON public.movie_render_jobs;
CREATE POLICY "Owner updates jobs"
ON public.movie_render_jobs FOR UPDATE TO authenticated
USING (is_owner())
WITH CHECK (is_owner());

DROP POLICY IF EXISTS "Users delete own jobs" ON public.movie_render_jobs;
CREATE POLICY "Users delete own jobs"
ON public.movie_render_jobs FOR DELETE TO authenticated
USING (auth.uid() = user_id OR is_owner());

DROP POLICY IF EXISTS "Users view own jobs" ON public.movie_render_jobs;
CREATE POLICY "Users view own jobs"
ON public.movie_render_jobs FOR SELECT TO authenticated
USING (auth.uid() = user_id OR is_owner());

-- 3) user_google_tokens: tighten to authenticated only, explicit per-command policies
DROP POLICY IF EXISTS "users manage own google tokens" ON public.user_google_tokens;
CREATE POLICY "users select own google tokens"
ON public.user_google_tokens FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "users insert own google tokens"
ON public.user_google_tokens FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users update own google tokens"
ON public.user_google_tokens FOR UPDATE TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users delete own google tokens"
ON public.user_google_tokens FOR DELETE TO authenticated
USING (auth.uid() = user_id);

REVOKE ALL ON public.user_google_tokens FROM anon;