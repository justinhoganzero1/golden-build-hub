
-- 1) Wallet balances: explicit owner-only UPDATE/DELETE
CREATE POLICY "Users update own wallet"
  ON public.wallet_balances FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own wallet"
  ON public.wallet_balances FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 2) Realtime authorization on call_sessions channel
-- Only the owner of a call session can subscribe to its realtime topic.
-- Topic format used by client: `call-sessions-<user_id>`
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users subscribe only to own call-sessions topic"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() = 'call-sessions-' || auth.uid()::text
    OR realtime.topic() = 'site_content_changes'
    OR realtime.topic() = 'site_announcements_changes'
  );

CREATE POLICY "Users broadcast only to own call-sessions topic"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() = 'call-sessions-' || auth.uid()::text
    OR realtime.topic() = 'site_content_changes'
    OR realtime.topic() = 'site_announcements_changes'
  );

-- 3) Site assets bucket: remove broad public listing, keep direct-URL viewing
DROP POLICY IF EXISTS "Public can view site assets" ON storage.objects;

-- Direct URL access still works (Supabase serves public buckets via CDN regardless of RLS)
-- but listing the bucket contents is now admin-only.
CREATE POLICY "Owner can list site assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'site-assets' AND public.is_owner());
