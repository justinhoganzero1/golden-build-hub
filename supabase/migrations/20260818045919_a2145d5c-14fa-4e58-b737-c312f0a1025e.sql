UPDATE public.user_media
SET title = 'SCAM THE SCAMMER — OZZY STYLE',
    metadata = jsonb_set(
      jsonb_set(COALESCE(metadata, '{}'::jsonb), '{author}', to_jsonb('Juzzy'::text), true),
      '{authorName}', to_jsonb('Juzzy'::text), true
    ),
    updated_at = now()
WHERE id = 'fa158608-3c67-4786-aff9-348a65a42ff5'::uuid
  AND title = 'SCAM THE SCAMMER — JUZZY STYLE';