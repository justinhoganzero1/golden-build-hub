CREATE TABLE public.trial_card_checks (
  user_id uuid PRIMARY KEY,
  stripe_env text NOT NULL CHECK (stripe_env IN ('sandbox','live')),
  card_fingerprint_hash text NOT NULL,
  card_brand text,
  card_last4 text,
  checkout_session_id text NOT NULL UNIQUE,
  verified_at timestamptz NOT NULL DEFAULT now(),
  trial_ends_at timestamptz NOT NULL,
  UNIQUE (stripe_env, card_fingerprint_hash)
);
GRANT SELECT ON public.trial_card_checks TO authenticated;
GRANT ALL ON public.trial_card_checks TO service_role;
ALTER TABLE public.trial_card_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own trial card check" ON public.trial_card_checks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owner reads all trial card checks" ON public.trial_card_checks FOR SELECT TO authenticated USING (public.is_owner());