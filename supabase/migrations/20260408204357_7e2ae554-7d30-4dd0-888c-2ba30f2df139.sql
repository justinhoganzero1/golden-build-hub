
-- Drop the two existing broad UPDATE policies
DROP POLICY IF EXISTS "Users can update own suggestion text only" ON public.suggestions;
DROP POLICY IF EXISTS "Users can update own suggestions" ON public.suggestions;

-- Create a single restricted UPDATE policy for regular users
-- The protect_suggestion_privileged_columns trigger already blocks privileged column changes,
-- but we also add WITH CHECK to enforce ownership
CREATE POLICY "Users can update own suggestions"
ON public.suggestions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Allow owner to update any suggestion (for admin actions)
CREATE POLICY "Owner can update all suggestions"
ON public.suggestions
FOR UPDATE
TO authenticated
USING (public.is_owner());

-- Also ensure the trigger exists for defense-in-depth
DROP TRIGGER IF EXISTS protect_suggestion_columns ON public.suggestions;
CREATE TRIGGER protect_suggestion_columns
BEFORE UPDATE ON public.suggestions
FOR EACH ROW
EXECUTE FUNCTION public.protect_suggestion_privileged_columns();
