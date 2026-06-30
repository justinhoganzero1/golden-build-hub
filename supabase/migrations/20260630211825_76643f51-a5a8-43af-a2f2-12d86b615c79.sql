
-- 1) user_claims: tighten policies + prevent user_id tampering
DROP POLICY IF EXISTS "Users view own claims" ON public.user_claims;
DROP POLICY IF EXISTS "Users create own claims" ON public.user_claims;
DROP POLICY IF EXISTS "Users update own claims" ON public.user_claims;
DROP POLICY IF EXISTS "Users delete own claims" ON public.user_claims;

CREATE POLICY "Users view own claims" ON public.user_claims
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own claims" ON public.user_claims
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own claims" ON public.user_claims
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own claims" ON public.user_claims
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.user_claims_lock_user_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'user_id is immutable on user_claims';
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS user_claims_lock_user_id_trg ON public.user_claims;
CREATE TRIGGER user_claims_lock_user_id_trg
  BEFORE UPDATE ON public.user_claims
  FOR EACH ROW EXECUTE FUNCTION public.user_claims_lock_user_id();

-- 2) referrals: hide referred_email at column level
DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Users can create referrals"  ON public.referrals;
CREATE POLICY "Users can view own referrals" ON public.referrals
  FOR SELECT TO authenticated USING (auth.uid() = referrer_id);
CREATE POLICY "Users can create referrals" ON public.referrals
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = referrer_id);

REVOKE SELECT ON public.referrals FROM anon, authenticated;
-- Re-grant SELECT on every column EXCEPT referred_email
DO $$
DECLARE col text; cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ') INTO cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='referrals'
    AND column_name <> 'referred_email';
  EXECUTE format('GRANT SELECT (%s) ON public.referrals TO authenticated', cols);
END $$;
GRANT INSERT, UPDATE, DELETE ON public.referrals TO authenticated;

-- 3) security_alerts: explicit deny user inserts (service role bypasses RLS)
CREATE POLICY "Block client inserts to security_alerts"
  ON public.security_alerts FOR INSERT TO anon, authenticated
  WITH CHECK (false);

-- 4) connect_accounts: explicit deny user writes (service role bypasses)
CREATE POLICY "Block client inserts to connect_accounts"
  ON public.connect_accounts FOR INSERT TO anon, authenticated
  WITH CHECK (false);
CREATE POLICY "Block client updates to connect_accounts"
  ON public.connect_accounts FOR UPDATE TO anon, authenticated
  USING (false) WITH CHECK (false);
CREATE POLICY "Block client deletes to connect_accounts"
  ON public.connect_accounts FOR DELETE TO anon, authenticated
  USING (false);

-- 5) user_media: strip metadata column from anonymous visitors
REVOKE SELECT ON public.user_media FROM anon;
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ') INTO cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='user_media'
    AND column_name <> 'metadata';
  EXECUTE format('GRANT SELECT (%s) ON public.user_media TO anon', cols);
END $$;

-- 6) affiliate_clicks: members only
DROP POLICY IF EXISTS "anyone can record affiliate clicks" ON public.affiliate_clicks;
CREATE POLICY "members record affiliate clicks"
  ON public.affiliate_clicks FOR INSERT TO authenticated WITH CHECK (true);

-- 7) stripe_event_log: drop open insert (service role bypasses RLS)
DROP POLICY IF EXISTS "service role writes stripe events" ON public.stripe_event_log;

-- 8) SECURITY DEFINER functions: revoke execute from anonymous visitors
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname,
           pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %I.%I(%s) FROM anon, public',
                   r.nspname, r.proname, r.args);
  END LOOP;
END $$;

-- 9) storage.objects: retarget {public}-role policies to authenticated only
ALTER POLICY "Admins can delete app files"         ON storage.objects TO authenticated;
ALTER POLICY "Admins can update app files"         ON storage.objects TO authenticated;
ALTER POLICY "Service role manages movie files"    ON storage.objects TO service_role;
ALTER POLICY "Users delete own movie files"        ON storage.objects TO authenticated;
ALTER POLICY "Users update own movie files"        ON storage.objects TO authenticated;
