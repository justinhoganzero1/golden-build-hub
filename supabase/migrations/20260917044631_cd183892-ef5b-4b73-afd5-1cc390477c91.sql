REVOKE ALL ON FUNCTION public.resolve_ai_tier(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_ai_tier(uuid) TO service_role;