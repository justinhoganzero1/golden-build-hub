
CREATE TABLE public.user_realms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Untitled Realm',
  prompt TEXT,
  skybox_url TEXT,
  avatar_id UUID REFERENCES public.user_avatars(id) ON DELETE SET NULL,
  avatar_url TEXT,
  props JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT false,
  share_slug TEXT UNIQUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_realms TO authenticated;
GRANT SELECT ON public.user_realms TO anon;
GRANT ALL ON public.user_realms TO service_role;

ALTER TABLE public.user_realms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public realms are viewable by anyone"
  ON public.user_realms FOR SELECT
  USING (is_public = true);

CREATE POLICY "Users can view their own realms"
  ON public.user_realms FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can create their own realms"
  ON public.user_realms FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own realms"
  ON public.user_realms FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can delete their own realms"
  ON public.user_realms FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TRIGGER trg_user_realms_updated_at
  BEFORE UPDATE ON public.user_realms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_user_realms_user_id ON public.user_realms(user_id);
CREATE INDEX idx_user_realms_share_slug ON public.user_realms(share_slug) WHERE share_slug IS NOT NULL;
CREATE INDEX idx_user_realms_public ON public.user_realms(is_public) WHERE is_public = true;
