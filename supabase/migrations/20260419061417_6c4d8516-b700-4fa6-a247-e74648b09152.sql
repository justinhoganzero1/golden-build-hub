
ALTER TABLE public.movie_projects
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS stripe_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent text,
  ADD COLUMN IF NOT EXISTS shotstack_render_id text,
  ADD COLUMN IF NOT EXISTS shotstack_status text,
  ADD COLUMN IF NOT EXISTS thumbnail_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS trailer_status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_movie_projects_payment_status
  ON public.movie_projects(payment_status);
CREATE INDEX IF NOT EXISTS idx_movie_projects_stripe_session
  ON public.movie_projects(stripe_session_id);
