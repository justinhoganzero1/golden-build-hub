DROP POLICY IF EXISTS "Anyone can submit creator comments" ON public.creator_comments;
DROP POLICY IF EXISTS "Anyone can submit investment offers" ON public.investment_offers;

CREATE POLICY "Anyone can submit creator comments"
ON public.creator_comments
FOR INSERT
TO public
WITH CHECK (
  length(trim(commenter_name)) > 0
  AND length(trim(message)) > 0
  AND (commenter_email IS NULL OR length(trim(commenter_email)) > 0)
);

CREATE POLICY "Anyone can submit investment offers"
ON public.investment_offers
FOR INSERT
TO public
WITH CHECK (
  length(trim(investor_name)) > 0
  AND length(trim(investor_email)) > 0
  AND length(trim(message)) > 0
  AND (offer_amount IS NULL OR length(trim(offer_amount)) > 0)
);