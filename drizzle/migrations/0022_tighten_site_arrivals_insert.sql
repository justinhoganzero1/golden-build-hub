DROP POLICY IF EXISTS "Anyone can record an anonymous arrival" ON public.site_arrivals;
CREATE POLICY "Anyone can record an anonymous arrival"
ON public.site_arrivals
FOR INSERT
TO anon, authenticated
WITH CHECK (
  landing_path IS NOT NULL AND char_length(landing_path) BETWEEN 1 AND 200
  AND (source IS NULL OR char_length(source) <= 100)
  AND (medium IS NULL OR char_length(medium) <= 100)
  AND (campaign IS NULL OR char_length(campaign) <= 100)
  AND (referrer IS NULL OR char_length(referrer) <= 500)
  AND (user_agent IS NULL OR char_length(user_agent) <= 200)
  AND country IS NULL
  AND country_basis IS NULL
  AND created_at > now() - interval '5 minutes'
  AND created_at < now() + interval '5 minutes'
);