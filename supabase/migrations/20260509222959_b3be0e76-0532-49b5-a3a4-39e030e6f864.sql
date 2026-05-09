ALTER TABLE public.featured_photos
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'photo';

DROP INDEX IF EXISTS featured_photos_active_rank_idx;
CREATE UNIQUE INDEX IF NOT EXISTS featured_photos_active_rank_cat_idx
  ON public.featured_photos (category, rank)
  WHERE active = true;