-- Security alerts table for tracking jailbreak attempts
CREATE TABLE public.security_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  user_email TEXT,
  alert_type TEXT NOT NULL DEFAULT 'jailbreak_attempt',
  severity TEXT NOT NULL DEFAULT 'warning',
  detected_phrase TEXT,
  user_message TEXT NOT NULL,
  warning_number INTEGER NOT NULL DEFAULT 1,
  action_taken TEXT NOT NULL DEFAULT 'warned',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner views all security alerts"
  ON public.security_alerts FOR SELECT
  TO authenticated
  USING (is_owner());

CREATE POLICY "Owner manages security alerts"
  ON public.security_alerts FOR ALL
  TO authenticated
  USING (is_owner())
  WITH CHECK (is_owner());

CREATE INDEX idx_security_alerts_user ON public.security_alerts(user_id, created_at DESC);

-- Function to count active jailbreak warnings for a user
CREATE OR REPLACE FUNCTION public.count_user_jailbreak_attempts(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(COUNT(*)::INTEGER, 0)
  FROM public.security_alerts
  WHERE user_id = _user_id
    AND alert_type = 'jailbreak_attempt'
    AND action_taken = 'warned';
$$;

-- Function to delete a user account permanently (cascades through auth.users)
CREATE OR REPLACE FUNCTION public.delete_user_account(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = _user_id;
  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.delete_user_account(UUID) FROM anon, authenticated;