REVOKE EXECUTE ON FUNCTION public.get_book_page(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_book_page(uuid) TO authenticated;