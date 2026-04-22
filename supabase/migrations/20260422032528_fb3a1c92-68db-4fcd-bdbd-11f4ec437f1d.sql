CREATE TABLE IF NOT EXISTS public.signup_failures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text,
  reason text NOT NULL,
  error_code text,
  user_agent text,
  source_page text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.signup_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log a failed signup"
  ON public.signup_failures
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (length(trim(reason)) > 0);

CREATE POLICY "Owner can view failed signups"
  ON public.signup_failures
  FOR SELECT
  TO authenticated
  USING (public.is_owner());

CREATE POLICY "Owner can delete failed signups"
  ON public.signup_failures
  FOR DELETE
  TO authenticated
  USING (public.is_owner());

CREATE INDEX IF NOT EXISTS idx_signup_failures_created_at ON public.signup_failures(created_at DESC);