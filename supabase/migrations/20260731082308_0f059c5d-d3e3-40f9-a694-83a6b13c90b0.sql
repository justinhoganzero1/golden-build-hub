CREATE TABLE public.admin_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  sender_name text,
  reply_to_email text,
  kind text not null default 'general',
  subject text not null default '',
  message text not null,
  is_read boolean not null default false,
  owner_reply text,
  replied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT ON public.admin_messages TO authenticated;
GRANT UPDATE ON public.admin_messages TO authenticated;
GRANT ALL ON public.admin_messages TO service_role;

ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users send their own messages"
  ON public.admin_messages FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND kind = ANY (ARRAY['general','idea','investor'])
    AND coalesce(is_read, false) = false
    AND owner_reply IS NULL
    AND replied_at IS NULL
  );

CREATE POLICY "Users read their own messages"
  ON public.admin_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_owner());

CREATE POLICY "Owner manages all messages"
  ON public.admin_messages FOR UPDATE TO authenticated
  USING (public.is_owner())
  WITH CHECK (public.is_owner());

CREATE INDEX idx_admin_messages_created ON public.admin_messages (created_at DESC);
CREATE INDEX idx_admin_messages_user ON public.admin_messages (user_id, created_at DESC);

CREATE TRIGGER update_admin_messages_updated_at
  BEFORE UPDATE ON public.admin_messages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();