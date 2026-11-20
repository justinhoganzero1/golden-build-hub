CREATE TABLE public.host_lipsync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_key text NOT NULL,
  prediction_id text,
  transaction_id uuid,
  status text NOT NULL DEFAULT 'starting' CHECK (status IN ('starting','running','settling','succeeded','failed')),
  resolution text NOT NULL DEFAULT '720p',
  requested_seconds numeric NOT NULL,
  output_seconds numeric,
  usd_per_second numeric NOT NULL,
  aud_per_usd numeric NOT NULL,
  provider_cost_cents integer,
  total_billed_cents integer,
  script_hash text,
  storage_path text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, request_key)
);

GRANT SELECT ON public.host_lipsync_jobs TO authenticated;
GRANT ALL ON public.host_lipsync_jobs TO service_role;

ALTER TABLE public.host_lipsync_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read their own lip-sync jobs"
ON public.host_lipsync_jobs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX host_lipsync_jobs_user_idx ON public.host_lipsync_jobs (user_id, created_at DESC);