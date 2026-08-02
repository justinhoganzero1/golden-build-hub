REVOKE EXECUTE ON FUNCTION public.get_story_writer_document(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_story_writer_document(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_story_writer_document(uuid) TO authenticated, service_role;