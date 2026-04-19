
CREATE TABLE IF NOT EXISTS public.app_unlocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  app_key TEXT NOT NULL,
  stripe_session_id TEXT,
  stripe_payment_intent TEXT,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, app_key)
);

ALTER TABLE public.app_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own unlocks"
  ON public.app_unlocks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owner views all unlocks"
  ON public.app_unlocks FOR SELECT
  TO authenticated
  USING (public.is_owner());

CREATE POLICY "Owner manages unlocks"
  ON public.app_unlocks FOR ALL
  TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

CREATE OR REPLACE FUNCTION public.has_app_unlock(_user_id UUID, _app_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.app_unlocks
    WHERE user_id = _user_id AND app_key = _app_key
  ) OR public.has_role(_user_id, 'admin');
$$;
