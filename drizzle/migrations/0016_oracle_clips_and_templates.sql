-- Active membership check (owner, founder, paid monthly or trial)
CREATE OR REPLACE FUNCTION public.is_active_member(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::public.app_role) OR EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = _user_id
      AND (
        m.founder_number IS NOT NULL
        OR (m.monthly_active_until IS NOT NULL AND m.monthly_active_until > now())
        OR (m.trial_ends_at IS NOT NULL AND m.trial_ends_at > now())
      )
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_active_member(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_member(uuid) TO authenticated, service_role;

-- Owner-published Oracle Lunar clips for members
CREATE TABLE public.oracle_clips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text,
  video_url text NOT NULL,
  poster_url text,
  duration_seconds integer,
  is_published boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.oracle_clips TO authenticated;
GRANT ALL ON public.oracle_clips TO service_role;

ALTER TABLE public.oracle_clips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members watch published clips" ON public.oracle_clips
  FOR SELECT TO authenticated
  USING ((is_published AND public.is_active_member(auth.uid())) OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Owner adds clips" ON public.oracle_clips
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Owner edits clips" ON public.oracle_clips
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "Owner deletes clips" ON public.oracle_clips
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE INDEX oracle_clips_published_idx ON public.oracle_clips (published_at DESC);

-- Members can opt in to let others copy a shared creation as a template
ALTER TABLE public.user_media ADD COLUMN IF NOT EXISTS allow_template boolean NOT NULL DEFAULT false;

CREATE OR REPLACE VIEW public.public_user_media AS
SELECT id, media_type, title, url, thumbnail_url, source_page,
       creator_display_name, shop_enabled, shop_price_cents,
       download_count, view_count, created_at, allow_template
FROM public.user_media
WHERE is_public = true;