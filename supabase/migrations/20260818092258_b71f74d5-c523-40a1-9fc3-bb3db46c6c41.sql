UPDATE public.user_media
SET metadata = COALESCE(metadata,'{}'::jsonb)
  || jsonb_build_object(
       'coverImage','https://tpkpfkcnqdyrzpqdoqnp.supabase.co/storage/v1/object/public/photography-assets/ozzy%2Ffront-cover-v4.jpg',
       'frontImage','https://tpkpfkcnqdyrzpqdoqnp.supabase.co/storage/v1/object/public/photography-assets/ozzy%2Ffront-cover-v4.jpg',
       'author','Juzzy',
       'coverLayout','masthead'),
    thumbnail_url = 'https://tpkpfkcnqdyrzpqdoqnp.supabase.co/storage/v1/object/public/photography-assets/ozzy%2Ffront-cover-v4.jpg'
WHERE id = 'fa158608-3c67-4786-aff9-348a65a42ff5';