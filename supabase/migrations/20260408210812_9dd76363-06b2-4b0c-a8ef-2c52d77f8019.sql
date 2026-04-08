DROP POLICY IF EXISTS "Users can create suggestions" ON public.suggestions;

CREATE POLICY "Users can create suggestions"
ON public.suggestions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND coalesce(granted_free_access, false) = false
  AND coalesce(status, 'pending') = 'pending'
  AND coalesce(ai_quality_score, 0) = 0
  AND ai_response IS NULL
);