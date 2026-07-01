ALTER TABLE public.user_realms
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS moderation_notes text;

CREATE INDEX IF NOT EXISTS idx_user_realms_tags ON public.user_realms USING gin (tags);
CREATE INDEX IF NOT EXISTS idx_user_realms_moderation ON public.user_realms (moderation_status);

CREATE TABLE IF NOT EXISTS public.realm_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  realm_id uuid NOT NULL REFERENCES public.user_realms(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text NOT NULL,
  details text,
  status text NOT NULL DEFAULT 'pending',
  action_taken text,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_realm_reports_status ON public.realm_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_realm_reports_realm ON public.realm_reports (realm_id);

GRANT SELECT, INSERT, UPDATE ON public.realm_reports TO authenticated;
GRANT ALL ON public.realm_reports TO service_role;

ALTER TABLE public.realm_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can file a report"
  ON public.realm_reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Reporters see their own reports"
  ON public.realm_reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins update reports"
  ON public.realm_reports FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins can moderate realms" ON public.user_realms;
CREATE POLICY "Admins can moderate realms"
  ON public.user_realms FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));