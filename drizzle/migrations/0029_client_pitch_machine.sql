CREATE TABLE public.pitch_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  business_url text NOT NULL,
  business_name text,
  offer_price text,
  status text NOT NULL DEFAULT 'draft',
  step text,
  step_error text,
  step_started_at timestamptz,
  snapshot jsonb,
  contacts jsonb,
  reviews jsonb,
  audit jsonb,
  demo_html text,
  deck jsonb,
  email jsonb,
  demo_token text UNIQUE,
  demo_enabled boolean NOT NULL DEFAULT false,
  demo_expires_at timestamptz,
  demo_views integer NOT NULL DEFAULT 0,
  demo_last_viewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pitch_projects TO authenticated;
GRANT ALL ON public.pitch_projects TO service_role;

ALTER TABLE public.pitch_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner reads pitch projects" ON public.pitch_projects
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner creates pitch projects" ON public.pitch_projects
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND owner_id = auth.uid());
CREATE POLICY "Owner updates pitch projects" ON public.pitch_projects
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owner deletes pitch projects" ON public.pitch_projects
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX pitch_projects_created_idx ON public.pitch_projects (created_at DESC);

CREATE TRIGGER pitch_projects_updated_at BEFORE UPDATE ON public.pitch_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();