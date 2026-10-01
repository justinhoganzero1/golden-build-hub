ALTER TABLE public.voice_agent_config ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.voice_call_logs ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.voice_call_logs ADD COLUMN IF NOT EXISTS billed_minutes integer NOT NULL DEFAULT 0;
UPDATE public.voice_agent_config SET owner_user_id = (SELECT id FROM auth.users WHERE email='justinbretthogan@gmail.com' LIMIT 1) WHERE owner_user_id IS NULL;
UPDATE public.voice_agent_config SET voice_id = 'JBFqnCBsd6RMkjVDRZzb' WHERE voice_id = '21m00Tcm4TlvDq8ikWAM';