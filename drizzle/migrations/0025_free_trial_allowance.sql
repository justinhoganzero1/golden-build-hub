CREATE TABLE public.free_trial_usage (
  user_id uuid PRIMARY KEY,
  images_used integer NOT NULL DEFAULT 0 CHECK (images_used >= 0),
  videos_used integer NOT NULL DEFAULT 0 CHECK (videos_used >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.free_trial_usage TO authenticated;
GRANT ALL ON public.free_trial_usage TO service_role;
ALTER TABLE public.free_trial_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read own trial usage" ON public.free_trial_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.claim_free_trial(_user_id uuid, _kind text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ok boolean := false;
BEGIN
  IF _kind NOT IN ('image','video') THEN RAISE EXCEPTION 'bad kind'; END IF;
  INSERT INTO public.free_trial_usage(user_id) VALUES (_user_id) ON CONFLICT DO NOTHING;
  IF _kind = 'image' THEN
    UPDATE public.free_trial_usage SET images_used = images_used + 1, updated_at = now()
      WHERE user_id = _user_id AND images_used < 3 RETURNING true INTO ok;
  ELSE
    UPDATE public.free_trial_usage SET videos_used = videos_used + 1, updated_at = now()
      WHERE user_id = _user_id AND videos_used < 1 RETURNING true INTO ok;
  END IF;
  RETURN coalesce(ok, false);
END $$;

CREATE OR REPLACE FUNCTION public.release_free_trial(_user_id uuid, _kind text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _kind = 'image' THEN
    UPDATE public.free_trial_usage SET images_used = greatest(images_used - 1, 0), updated_at = now() WHERE user_id = _user_id;
  ELSIF _kind = 'video' THEN
    UPDATE public.free_trial_usage SET videos_used = greatest(videos_used - 1, 0), updated_at = now() WHERE user_id = _user_id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.claim_free_trial(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_free_trial(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_free_trial(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_free_trial(uuid, text) TO service_role;