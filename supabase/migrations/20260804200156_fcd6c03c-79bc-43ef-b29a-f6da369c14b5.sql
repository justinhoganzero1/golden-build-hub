DROP POLICY IF EXISTS "Anyone can submit advertiser inquiry" ON public.advertiser_inquiries;
CREATE POLICY "Anyone can submit advertiser inquiry"
ON public.advertiser_inquiries
FOR INSERT
WITH CHECK (
  length(trim(both from company)) > 0
  AND length(trim(both from contact_name)) > 0
  AND length(trim(both from email)) > 0
  AND length(trim(both from message)) > 0
  AND ai_notes IS NULL
);

DROP POLICY IF EXISTS "Anyone can submit a lead" ON public.inquiry_leads;
CREATE POLICY "Anyone can submit a lead"
ON public.inquiry_leads
FOR INSERT
WITH CHECK (
  length(trim(both from message)) > 0
  AND (email IS NULL OR length(trim(both from email)) > 0)
  AND ai_summary IS NULL
);