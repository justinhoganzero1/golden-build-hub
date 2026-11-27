ALTER TABLE public.user_ai_keys ADD COLUMN IF NOT EXISTS claude_key text, ADD COLUMN IF NOT EXISTS preferred_provider text NOT NULL DEFAULT 'auto';
CREATE TABLE public.personal_plugins (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL, description text NOT NULL DEFAULT '', kind text NOT NULL, endpoint_ciphertext text NOT NULL, auth_method text NOT NULL DEFAULT 'none', auth_header text NOT NULL DEFAULT 'X-API-Key', key_ciphertext text, enabled boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.personal_plugins TO service_role;
ALTER TABLE public.personal_plugins ENABLE ROW LEVEL SECURITY;
CREATE INDEX personal_plugins_user_created_idx ON public.personal_plugins(user_id,created_at DESC);
CREATE TABLE public.personal_plugin_runs (
 id uuid PRIMARY KEY, user_id uuid NOT NULL, plugin_id uuid NOT NULL REFERENCES public.personal_plugins(id) ON DELETE CASCADE, status text NOT NULL DEFAULT 'started', result text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.personal_plugin_runs TO service_role;
ALTER TABLE public.personal_plugin_runs ENABLE ROW LEVEL SECURITY;
CREATE INDEX personal_plugin_runs_user_created_idx ON public.personal_plugin_runs(user_id,created_at DESC);
CREATE INDEX personal_plugin_runs_plugin_idx ON public.personal_plugin_runs(plugin_id);
REVOKE ALL ON public.user_ai_keys FROM anon,authenticated;
REVOKE ALL ON public.user_connectors FROM anon,authenticated;
GRANT ALL ON public.user_ai_keys,public.user_connectors TO service_role;