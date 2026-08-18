UPDATE public.user_media
SET metadata = jsonb_set(jsonb_set(COALESCE(metadata,'{}'::jsonb), '{coverImage}', to_jsonb('https://tpkpfkcnqdyrzpqdoqnp.supabase.co/storage/v1/object/public/photography-assets/ozzy%2Ffront-cover-v3.jpg'::text)), '{frontImage}', to_jsonb('https://tpkpfkcnqdyrzpqdoqnp.supabase.co/storage/v1/object/public/photography-assets/ozzy%2Ffront-cover-v3.jpg'::text)),
    thumbnail_url = 'https://tpkpfkcnqdyrzpqdoqnp.supabase.co/storage/v1/object/public/photography-assets/ozzy%2Ffront-cover-v3.jpg'
WHERE id = 'fa158608-3c67-4786-aff9-348a65a42ff5';