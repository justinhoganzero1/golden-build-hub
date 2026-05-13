DROP TRIGGER IF EXISTS profiles_enforce_age ON public.profiles;
DROP FUNCTION IF EXISTS public.enforce_minimum_age();