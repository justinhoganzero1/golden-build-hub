
CREATE TABLE IF NOT EXISTS public.user_connectors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  api_key text,
  enabled boolean NOT NULL DEFAULT false,
  connected_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, provider)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_connectors TO authenticated;
GRANT ALL ON public.user_connectors TO service_role;
ALTER TABLE public.user_connectors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own connectors select" ON public.user_connectors FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own connectors insert" ON public.user_connectors FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own connectors update" ON public.user_connectors FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own connectors delete" ON public.user_connectors FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS user_connectors_user_id_idx ON public.user_connectors(user_id);
