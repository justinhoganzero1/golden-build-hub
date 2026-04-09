DROP POLICY IF EXISTS "Users can update own suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Users can update suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Users can update own suggestion" ON public.suggestions;

CREATE POLICY "Users cannot directly update suggestions"
ON public.suggestions
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);