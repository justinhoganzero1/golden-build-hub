
-- Persistent job log + cache for image generation reliability
CREATE TABLE IF NOT EXISTS public.image_generation_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  tier TEXT,
  model_chain JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_attempts INTEGER NOT NULL DEFAULT 9,
  attempts INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  last_model TEXT,
  result_url TEXT,
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_img_jobs_user_hash_status
  ON public.image_generation_jobs(user_id, prompt_hash, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_img_jobs_status
  ON public.image_generation_jobs(status, created_at DESC);

ALTER TABLE public.image_generation_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own image jobs"
  ON public.image_generation_jobs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR is_owner());

CREATE POLICY "Owner manages image jobs"
  ON public.image_generation_jobs FOR ALL
  TO authenticated
  USING (is_owner()) WITH CHECK (is_owner());

CREATE TRIGGER trg_image_generation_jobs_updated
  BEFORE UPDATE ON public.image_generation_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
