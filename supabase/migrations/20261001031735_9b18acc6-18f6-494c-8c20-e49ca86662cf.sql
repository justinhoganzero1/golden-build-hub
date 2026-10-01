CREATE TABLE public.founder_seat_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL,
  founder_number int NOT NULL,
  price_cents int NOT NULL CHECK (price_cents >= 100 AND price_cents <= 100000000),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','sold','cancelled')),
  buyer_id uuid,
  sold_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX founder_seat_one_active ON public.founder_seat_listings(seller_id) WHERE status = 'active';
GRANT SELECT, INSERT, UPDATE ON public.founder_seat_listings TO authenticated;
GRANT ALL ON public.founder_seat_listings TO service_role;
ALTER TABLE public.founder_seat_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view active listings" ON public.founder_seat_listings FOR SELECT TO authenticated
  USING (status = 'active' OR seller_id = auth.uid() OR buyer_id = auth.uid());
CREATE POLICY "Founders list own seat" ON public.founder_seat_listings FOR INSERT TO authenticated
  WITH CHECK (seller_id = auth.uid() AND status = 'active' AND buyer_id IS NULL
    AND founder_number = (SELECT m.founder_number FROM public.memberships m WHERE m.user_id = auth.uid()));
CREATE POLICY "Sellers cancel own listing" ON public.founder_seat_listings FOR UPDATE TO authenticated
  USING (seller_id = auth.uid() AND status = 'active')
  WITH CHECK (seller_id = auth.uid() AND status = 'cancelled' AND buyer_id IS NULL);
CREATE TRIGGER founder_seat_listings_updated BEFORE UPDATE ON public.founder_seat_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
GRANT EXECUTE ON FUNCTION public.public_founder_seats_left() TO anon, authenticated;