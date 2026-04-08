
-- Fix privilege escalation on suggestions: drop permissive UPDATE, replace with restricted one
DROP POLICY IF EXISTS "Users can update suggestions" ON public.suggestions;
DROP POLICY IF EXISTS "Users can update their own suggestions" ON public.suggestions;

CREATE POLICY "Users can update own suggestion text only"
ON public.suggestions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create a trigger to prevent users from changing privileged columns
CREATE OR REPLACE FUNCTION public.protect_suggestion_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only owner can change these fields
  IF NOT public.is_owner() THEN
    NEW.granted_free_access := OLD.granted_free_access;
    NEW.ai_quality_score := OLD.ai_quality_score;
    NEW.ai_response := OLD.ai_response;
    NEW.status := OLD.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_suggestions_privileged
BEFORE UPDATE ON public.suggestions
FOR EACH ROW
EXECUTE FUNCTION public.protect_suggestion_privileged_columns();

-- Add DELETE policy on referrals
CREATE POLICY "Users can delete own referrals"
ON public.referrals
FOR DELETE
TO authenticated
USING (auth.uid() = referrer_id);
