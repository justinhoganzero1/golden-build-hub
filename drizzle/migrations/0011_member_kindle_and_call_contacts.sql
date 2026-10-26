CREATE TABLE public.member_kindle_settings (
  user_id uuid PRIMARY KEY,
  kindle_email text NOT NULL CHECK (kindle_email ~* '^[^\s@]+@(kindle\.com|free\.kindle\.com)$' AND length(kindle_email) <= 254),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_kindle_settings TO authenticated;
GRANT ALL ON public.member_kindle_settings TO service_role;
ALTER TABLE public.member_kindle_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage own Kindle address" ON public.member_kindle_settings
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.member_call_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '' CHECK (length(name) <= 120),
  phone text NOT NULL CHECK (phone ~ '^\+[1-9][0-9]{6,14}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, phone)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.member_call_contacts TO authenticated;
GRANT ALL ON public.member_call_contacts TO service_role;
ALTER TABLE public.member_call_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members manage own call contacts" ON public.member_call_contacts
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);