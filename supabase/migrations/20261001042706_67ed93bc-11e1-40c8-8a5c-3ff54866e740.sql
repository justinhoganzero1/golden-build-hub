CREATE TABLE public.creator_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 2 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 500),
  kind text NOT NULL CHECK (kind IN ('quiz','tracker')),
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  shop_enabled boolean NOT NULL DEFAULT false,
  shop_price_cents integer NOT NULL DEFAULT 0 CHECK (shop_price_cents = 0 OR shop_price_cents BETWEEN 100 AND 50000),
  download_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creator_modules TO authenticated;
GRANT ALL ON public.creator_modules TO service_role;
ALTER TABLE public.creator_modules ENABLE ROW LEVEL SECURITY;
-- Owners see everything of theirs; others see listing info only for public ones.
CREATE POLICY "Owner manages own modules" ON public.creator_modules FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Members see free public modules" ON public.creator_modules FOR SELECT TO authenticated
  USING (is_public AND shop_price_cents = 0);
CREATE POLICY "Buyers see purchased modules" ON public.creator_modules FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.shop_purchases p WHERE p.item_kind='module' AND p.item_id=creator_modules.id AND p.buyer_id=auth.uid() AND p.status='paid'));
CREATE TRIGGER trg_creator_modules_updated BEFORE UPDATE ON public.creator_modules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Stop owners faking sales counts.
CREATE OR REPLACE FUNCTION public.protect_creator_module_counts() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN NEW.download_count := OLD.download_count; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_protect_creator_module_counts BEFORE UPDATE ON public.creator_modules FOR EACH ROW EXECUTE FUNCTION public.protect_creator_module_counts();
-- Paid listings: browse info only (no config) for every member.
CREATE OR REPLACE FUNCTION public.list_module_shop() RETURNS TABLE(id uuid, user_id uuid, title text, description text, kind text, shop_price_cents integer, download_count integer, owned boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT m.id, m.user_id, m.title, m.description, m.kind, m.shop_price_cents, m.download_count,
    (m.user_id = auth.uid() OR m.shop_price_cents = 0 OR EXISTS (SELECT 1 FROM shop_purchases p WHERE p.item_kind='module' AND p.item_id=m.id AND p.buyer_id=auth.uid() AND p.status='paid'))
  FROM creator_modules m WHERE m.is_public AND auth.uid() IS NOT NULL ORDER BY m.created_at DESC LIMIT 200
$$;
REVOKE EXECUTE ON FUNCTION public.list_module_shop() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.list_module_shop() TO authenticated;