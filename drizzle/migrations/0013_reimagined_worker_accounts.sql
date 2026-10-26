ALTER TABLE public.reimagined_demo_access ADD COLUMN account_kind text NOT NULL DEFAULT 'manager', ADD COLUMN demo_key text NOT NULL DEFAULT 'manager', ADD COLUMN assigned_claim_id text;
CREATE UNIQUE INDEX reimagined_demo_key_unique ON public.reimagined_demo_access(demo_key);
CREATE OR REPLACE FUNCTION public.reimagined_can_access_claim(_claim_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS (SELECT 1 FROM public.reimagined_demo_access WHERE user_id=auth.uid() AND enabled AND (account_kind='manager' OR (account_kind='worker' AND assigned_claim_id=_claim_id))) $$;
REVOKE ALL ON FUNCTION public.reimagined_can_access_claim(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reimagined_can_access_claim(text) TO authenticated, service_role;
CREATE TABLE public.reimagined_worker_cases (
 claim_id text PRIMARY KEY,
 worker_user_id uuid UNIQUE NOT NULL,
 worker_name text NOT NULL,
 employer text NOT NULL,
 injury text NOT NULL,
 stage text NOT NULL DEFAULT 'Review',
 capacity text NOT NULL,
 next_step text NOT NULL DEFAULT 'Your case manager will review your current capacity certificate.',
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.reimagined_worker_cases TO authenticated;
GRANT ALL ON public.reimagined_worker_cases TO service_role;
ALTER TABLE public.reimagined_worker_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assigned workers and demo managers read cases" ON public.reimagined_worker_cases FOR SELECT TO authenticated USING (public.reimagined_can_access_claim(claim_id));
CREATE POLICY "Demo managers update worker plan" ON public.reimagined_worker_cases FOR UPDATE TO authenticated USING (EXISTS(SELECT 1 FROM public.reimagined_demo_access WHERE user_id=auth.uid() AND enabled AND account_kind='manager')) WITH CHECK (EXISTS(SELECT 1 FROM public.reimagined_demo_access WHERE user_id=auth.uid() AND enabled AND account_kind='manager'));
CREATE TABLE public.reimagined_worker_messages (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 claim_id text NOT NULL REFERENCES public.reimagined_worker_cases(claim_id),
 sender_id uuid NOT NULL DEFAULT auth.uid(),
 text text NOT NULL CHECK (length(text) BETWEEN 1 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.reimagined_worker_messages TO authenticated;
GRANT ALL ON public.reimagined_worker_messages TO service_role;
ALTER TABLE public.reimagined_worker_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Assigned workers and managers read messages" ON public.reimagined_worker_messages FOR SELECT TO authenticated USING (public.reimagined_can_access_claim(claim_id));
CREATE POLICY "Assigned worker or manager sends own message" ON public.reimagined_worker_messages FOR INSERT TO authenticated WITH CHECK (sender_id=auth.uid() AND public.reimagined_can_access_claim(claim_id));