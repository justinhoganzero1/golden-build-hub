CREATE TABLE public.advertiser_inquiries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  website TEXT,
  budget TEXT,
  ad_type TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  ai_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.advertiser_inquiries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit advertiser inquiry"
ON public.advertiser_inquiries
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(company)) > 0
  AND length(trim(contact_name)) > 0
  AND length(trim(email)) > 0
  AND length(trim(message)) > 0
);

CREATE POLICY "Owner can view advertiser inquiries"
ON public.advertiser_inquiries
FOR SELECT
TO authenticated
USING (is_owner());

CREATE POLICY "Owner can update advertiser inquiries"
ON public.advertiser_inquiries
FOR UPDATE
TO authenticated
USING (is_owner());

CREATE POLICY "Owner can delete advertiser inquiries"
ON public.advertiser_inquiries
FOR DELETE
TO authenticated
USING (is_owner());

CREATE TRIGGER trg_advertiser_inquiries_updated
BEFORE UPDATE ON public.advertiser_inquiries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();