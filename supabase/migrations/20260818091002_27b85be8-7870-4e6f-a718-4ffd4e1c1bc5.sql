update public.user_media
set metadata = metadata
  || jsonb_build_object(
    'coverImage','https://tpkpfkcnqdyrzpqdoqnp.supabase.co/storage/v1/object/public/photography-assets/de86fb68-3fe7-4a1b-a5a5-4da5f0453b87/stories/ozzy-mosaic-front-v2.jpg',
    'backImage','https://tpkpfkcnqdyrzpqdoqnp.supabase.co/storage/v1/object/public/photography-assets/de86fb68-3fe7-4a1b-a5a5-4da5f0453b87/stories/ozzy-mosaic-back-v2.jpg'
  ),
  thumbnail_url = 'https://tpkpfkcnqdyrzpqdoqnp.supabase.co/storage/v1/object/public/photography-assets/de86fb68-3fe7-4a1b-a5a5-4da5f0453b87/stories/ozzy-mosaic-front-v2.jpg',
  updated_at = now()
where id = 'fa158608-3c67-4786-aff9-348a65a42ff5';