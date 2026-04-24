-- Add public/shop fields to user_media
ALTER TABLE public.user_media
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shop_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shop_price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creator_display_name text,
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Add public/shop fields to living_gifs
ALTER TABLE public.living_gifs
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shop_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shop_price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creator_display_name text,
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Add public/shop fields to movie_projects
ALTER TABLE public.movie_projects
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shop_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS shop_price_cents integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS creator_display_name text,
  ADD COLUMN IF NOT EXISTS download_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

-- Per-user, per-module auto-publish preferences
CREATE TABLE IF NOT EXISTS public.module_publish_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  module_key text NOT NULL,
  auto_publish boolean NOT NULL DEFAULT false,
  default_shop_enabled boolean NOT NULL DEFAULT false,
  default_shop_price_cents integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, module_key)
);
ALTER TABLE public.module_publish_prefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own publish prefs" ON public.module_publish_prefs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner views all publish prefs" ON public.module_publish_prefs
  FOR SELECT TO authenticated USING (is_owner());

-- Shop purchases
CREATE TABLE IF NOT EXISTS public.shop_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id uuid NOT NULL,
  creator_id uuid NOT NULL,
  item_kind text NOT NULL,
  item_id uuid NOT NULL,
  amount_cents integer NOT NULL,
  platform_fee_cents integer NOT NULL,
  creator_payout_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'usd',
  stripe_session_id text,
  stripe_payment_intent text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
ALTER TABLE public.shop_purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Buyer views own purchases" ON public.shop_purchases
  FOR SELECT TO authenticated USING (auth.uid() = buyer_id);
CREATE POLICY "Creator views own sales" ON public.shop_purchases
  FOR SELECT TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "Owner views all" ON public.shop_purchases
  FOR ALL TO authenticated USING (is_owner()) WITH CHECK (is_owner());

-- Public RLS policies (anyone signed in can browse public items)
CREATE POLICY "Anyone views public media" ON public.user_media
  FOR SELECT TO authenticated, anon USING (is_public = true);
CREATE POLICY "Anyone views public gifs" ON public.living_gifs
  FOR SELECT TO authenticated, anon USING (is_public = true AND status = 'completed');
CREATE POLICY "Anyone views public movies" ON public.movie_projects
  FOR SELECT TO authenticated, anon USING (is_public = true AND status = 'completed');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_media_public ON public.user_media (is_public, created_at DESC) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_living_gifs_public ON public.living_gifs (is_public, created_at DESC) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_movie_projects_public ON public.movie_projects (is_public, created_at DESC) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_shop_purchases_buyer ON public.shop_purchases (buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_purchases_creator ON public.shop_purchases (creator_id, created_at DESC);