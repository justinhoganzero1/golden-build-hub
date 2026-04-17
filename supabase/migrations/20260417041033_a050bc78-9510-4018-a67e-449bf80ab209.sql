CREATE INDEX IF NOT EXISTS idx_user_media_user_created ON public.user_media (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_media_created ON public.user_media (created_at DESC);