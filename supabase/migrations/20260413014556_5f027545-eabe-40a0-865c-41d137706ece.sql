
-- Fix 1: Require authentication for investment_offers INSERT
DROP POLICY IF EXISTS "Anyone can submit investment offers" ON public.investment_offers;
CREATE POLICY "Authenticated users can submit investment offers"
ON public.investment_offers
FOR INSERT
TO authenticated
WITH CHECK (
  (length(TRIM(BOTH FROM investor_name)) > 0)
  AND (length(TRIM(BOTH FROM investor_email)) > 0)
  AND (length(TRIM(BOTH FROM message)) > 0)
  AND ((offer_amount IS NULL) OR (length(TRIM(BOTH FROM offer_amount)) > 0))
);

-- Fix 3: Convert user_roles write-blocking policies to RESTRICTIVE
DROP POLICY IF EXISTS "No public inserts on user_roles" ON public.user_roles;
CREATE POLICY "No inserts on user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (false);

DROP POLICY IF EXISTS "No public updates on user_roles" ON public.user_roles;
CREATE POLICY "No updates on user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

DROP POLICY IF EXISTS "No public deletes on user_roles" ON public.user_roles;
CREATE POLICY "No deletes on user_roles"
ON public.user_roles
AS RESTRICTIVE
FOR DELETE
TO authenticated
USING (false);
