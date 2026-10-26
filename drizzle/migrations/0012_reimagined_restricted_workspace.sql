CREATE TABLE public.reimagined_demo_access (
 user_id uuid PRIMARY KEY,
 enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reimagined_demo_access TO authenticated;
GRANT ALL ON public.reimagined_demo_access TO service_role;
ALTER TABLE public.reimagined_demo_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Demo users read own access" ON public.reimagined_demo_access FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TABLE public.reimagined_workspaces (
 user_id uuid PRIMARY KEY,
 data jsonb NOT NULL DEFAULT '{}'::jsonb,
 version integer NOT NULL DEFAULT 0,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT workspace_payload_size CHECK (octet_length(data::text) <= 500000)
);
GRANT SELECT, INSERT, UPDATE ON public.reimagined_workspaces TO authenticated;
GRANT ALL ON public.reimagined_workspaces TO service_role;
ALTER TABLE public.reimagined_workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Restricted demo workspace read" ON public.reimagined_workspaces FOR SELECT TO authenticated USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.reimagined_demo_access a WHERE a.user_id = auth.uid() AND a.enabled));
CREATE POLICY "Restricted demo workspace insert" ON public.reimagined_workspaces FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.reimagined_demo_access a WHERE a.user_id = auth.uid() AND a.enabled));
CREATE POLICY "Restricted demo workspace update" ON public.reimagined_workspaces FOR UPDATE TO authenticated USING (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.reimagined_demo_access a WHERE a.user_id = auth.uid() AND a.enabled)) WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.reimagined_demo_access a WHERE a.user_id = auth.uid() AND a.enabled));
CREATE TABLE public.reimagined_login_limits (
 ip_hash text PRIMARY KEY,
 window_start timestamptz NOT NULL DEFAULT now(),
 attempts integer NOT NULL DEFAULT 1
);
GRANT ALL ON public.reimagined_login_limits TO service_role;
ALTER TABLE public.reimagined_login_limits ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.reimagined_login_allowed(_ip_hash text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
 INSERT INTO public.reimagined_login_limits(ip_hash) VALUES (_ip_hash)
 ON CONFLICT(ip_hash) DO UPDATE SET
 attempts = CASE WHEN reimagined_login_limits.window_start < now() - interval '1 hour' THEN 1 ELSE reimagined_login_limits.attempts + 1 END,
 window_start = CASE WHEN reimagined_login_limits.window_start < now() - interval '1 hour' THEN now() ELSE reimagined_login_limits.window_start END
 RETURNING attempts INTO n;
 RETURN n <= 20;
END; $$;
REVOKE ALL ON FUNCTION public.reimagined_login_allowed(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reimagined_login_allowed(text) TO service_role;