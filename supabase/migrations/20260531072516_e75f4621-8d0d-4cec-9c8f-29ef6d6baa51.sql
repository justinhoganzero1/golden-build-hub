DO $$
DECLARE
  v_uid uuid;
BEGIN
  SELECT id INTO v_uid FROM auth.users
  WHERE lower(email) IN ('donald.duck@oracle-lunar.online','donaldduck@oracle-lunar.online','donald@oracle-lunar.online')
  LIMIT 1;

  IF v_uid IS NOT NULL THEN
    DELETE FROM public.user_media WHERE user_id = v_uid;
    DELETE FROM public.user_roles WHERE user_id = v_uid;
    DELETE FROM public.profiles WHERE id = v_uid OR user_id = v_uid;
    DELETE FROM auth.users WHERE id = v_uid;
  END IF;
END $$;

-- Clean any leftover library rows that explicitly reference Donald Duck in title
DELETE FROM public.user_media
WHERE title ILIKE '%donald duck%';
