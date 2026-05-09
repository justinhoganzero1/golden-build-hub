ALTER TABLE public.featured_photos
  ADD COLUMN IF NOT EXISTS rank integer NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS featured_photos_active_rank_unique
  ON public.featured_photos (rank)
  WHERE active = true;