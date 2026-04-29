REVOKE EXECUTE ON FUNCTION public.save_library_item_for_user(uuid, text, text, text, text, text, jsonb, boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.capture_library_from_known_asset() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.save_library_item(text, text, text, text, text, jsonb, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_library_item(text, text, text, text, text, jsonb, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_media_type_from_url(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.library_media_type_from_url(text, text) TO service_role;