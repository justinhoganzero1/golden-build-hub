-- 1) Fix storage.objects policy: service_role bypasses RLS anyway, but the
-- explicit policy incorrectly required is_owner() (auth.uid() is NULL under
-- service role, so the policy always evaluated false).
DROP POLICY IF EXISTS "Service role manages movie files" ON storage.objects;
CREATE POLICY "Service role manages movie files"
ON storage.objects
AS PERMISSIVE
FOR ALL
TO service_role
USING (bucket_id = 'movies')
WITH CHECK (bucket_id = 'movies');

-- 2) Document voice_knowledge_items intent: reads happen from the voice
-- receptionist edge function using the service role key. The owner-only
-- RLS policy is intentional; end users never read this table directly.
COMMENT ON TABLE public.voice_knowledge_items IS
  'Voice receptionist FAQ. Read exclusively by the voice-receptionist-incoming edge function using the service role (bypasses RLS). Owner-only RLS is intentional — no anon/authenticated read policy required.';

-- 3) Tighten SECURITY DEFINER function EXECUTE grants. Revoke from anon/
-- authenticated roles for helpers that are only called by backend/edge code
-- (they run as service_role and don't need these grants). Policy-critical
-- helpers (has_role, is_owner) and user-callable RPCs (save_library_item,
-- has_app_unlock, photo_template_quota, retry_failed_scene) keep their grants.
REVOKE EXECUTE ON FUNCTION public.has_active_reward(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_unlimited_ai(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_anon_visitor(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_owner_email_locked() FROM anon, authenticated;