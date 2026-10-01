CREATE TABLE public.book_amazon_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  story_id uuid NOT NULL UNIQUE,
  isbn text CHECK (isbn IS NULL OR isbn ~ '^[0-9Xx-]{10,17}$'),
  asin text CHECK (asin IS NULL OR asin ~ '^[A-Za-z0-9]{10}$'),
  amazon_url text CHECK (amazon_url IS NULL OR amazon_url ~* '^https://(www\.)?amazon\.[a-z.]{2,8}/'),
  marketplace text DEFAULT 'amazon.com.au',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_amazon_links TO authenticated;
GRANT ALL ON public.book_amazon_links TO service_role;
ALTER TABLE public.book_amazon_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view Amazon links" ON public.book_amazon_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authors add own links" ON public.book_amazon_links FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.user_media m WHERE m.id = story_id AND m.user_id = auth.uid()));
CREATE POLICY "Authors edit own links" ON public.book_amazon_links FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Authors delete own links" ON public.book_amazon_links FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_book_amazon_links_updated BEFORE UPDATE ON public.book_amazon_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();