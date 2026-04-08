
-- Investment offers table
CREATE TABLE public.investment_offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  investor_name TEXT NOT NULL,
  investor_email TEXT NOT NULL,
  offer_amount TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  ai_score INTEGER DEFAULT 0,
  ai_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.investment_offers ENABLE ROW LEVEL SECURITY;

-- Anyone can submit an investment offer
CREATE POLICY "Anyone can submit investment offers"
  ON public.investment_offers FOR INSERT
  WITH CHECK (true);

-- Only owner can view offers
CREATE POLICY "Owner can view all investment offers"
  ON public.investment_offers FOR SELECT
  TO authenticated
  USING (public.is_owner());

-- Only owner can update offers
CREATE POLICY "Owner can update investment offers"
  ON public.investment_offers FOR UPDATE
  TO authenticated
  USING (public.is_owner());

-- Only owner can delete offers
CREATE POLICY "Owner can delete investment offers"
  ON public.investment_offers FOR DELETE
  TO authenticated
  USING (public.is_owner());

-- Creator comments table
CREATE TABLE public.creator_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  commenter_name TEXT NOT NULL,
  commenter_email TEXT,
  message TEXT NOT NULL,
  moderation_status TEXT NOT NULL DEFAULT 'pending',
  ai_moderation_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.creator_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can submit a comment
CREATE POLICY "Anyone can submit creator comments"
  ON public.creator_comments FOR INSERT
  WITH CHECK (true);

-- Anyone can view approved comments
CREATE POLICY "Anyone can view approved comments"
  ON public.creator_comments FOR SELECT
  USING (moderation_status = 'approved' OR public.is_owner());

-- Only owner can update comments
CREATE POLICY "Owner can update creator comments"
  ON public.creator_comments FOR UPDATE
  TO authenticated
  USING (public.is_owner());

-- Only owner can delete comments
CREATE POLICY "Owner can delete creator comments"
  ON public.creator_comments FOR DELETE
  TO authenticated
  USING (public.is_owner());

-- Triggers for updated_at
CREATE TRIGGER update_investment_offers_updated_at
  BEFORE UPDATE ON public.investment_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_creator_comments_updated_at
  BEFORE UPDATE ON public.creator_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
