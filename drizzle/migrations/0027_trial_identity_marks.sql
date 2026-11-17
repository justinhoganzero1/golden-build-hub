CREATE TABLE public.trial_identity_marks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mark_kind text NOT NULL CHECK (mark_kind IN ('email','device','ip')),
  mark_hash text NOT NULL CHECK (char_length(mark_hash) = 64),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (mark_kind, mark_hash, user_id)
);
GRANT ALL ON public.trial_identity_marks TO service_role;
REVOKE ALL ON public.trial_identity_marks FROM anon, authenticated;
ALTER TABLE public.trial_identity_marks ENABLE ROW LEVEL SECURITY;
CREATE INDEX trial_identity_marks_lookup ON public.trial_identity_marks (mark_kind, mark_hash);
COMMENT ON TABLE public.trial_identity_marks IS 'Hashed email/device/IP marks from accounts that started a free trial; service-only, kept after account deletion so a new account cannot claim a second trial.';

-- Backfill: emails of accounts that already started a trial.
INSERT INTO public.trial_identity_marks (mark_kind, mark_hash, user_id)
SELECT 'email',
       encode(extensions.digest('oracle-trial-v1:email:' ||
         CASE WHEN dom IN ('gmail.com','googlemail.com') THEN replace(loc, '.', '') || '@gmail.com' ELSE loc || '@' || dom END, 'sha256'), 'hex'),
       t.user_id
FROM public.trial_card_checks t
JOIN LATERAL (
  SELECT split_part(split_part(lower(trim(u.email)), '@', 1), '+', 1) AS loc,
         split_part(lower(trim(u.email)), '@', 2) AS dom
  FROM auth.users u WHERE u.id = t.user_id AND u.email IS NOT NULL
) e ON true
ON CONFLICT DO NOTHING;