
CREATE TABLE public.inquiry_leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  email TEXT,
  phone TEXT,
  interest TEXT,
  message TEXT NOT NULL,
  ai_summary TEXT,
  source TEXT NOT NULL DEFAULT 'concierge',
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.inquiry_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit a lead"
  ON public.inquiry_leads FOR INSERT
  WITH CHECK (
    length(trim(message)) > 0
    AND (email IS NULL OR length(trim(email)) > 0)
  );

CREATE POLICY "Owner can view all leads"
  ON public.inquiry_leads FOR SELECT
  TO authenticated
  USING (public.is_owner());

CREATE POLICY "Owner can update leads"
  ON public.inquiry_leads FOR UPDATE
  TO authenticated
  USING (public.is_owner());

CREATE POLICY "Owner can delete leads"
  ON public.inquiry_leads FOR DELETE
  TO authenticated
  USING (public.is_owner());

CREATE TRIGGER update_inquiry_leads_updated_at
  BEFORE UPDATE ON public.inquiry_leads
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
