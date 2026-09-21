CREATE TABLE public.kindle_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  filename text NOT NULL,
  kindle_email text NOT NULL,
  sender_email text NOT NULL,
  file_size_bytes bigint NOT NULL CHECK (file_size_bytes > 0),
  provider_message_id text UNIQUE,
  status text NOT NULL DEFAULT 'preparing' CHECK (status IN ('preparing','queued','delivered_to_mail_server','delayed','bounced','failed')),
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.kindle_deliveries TO authenticated;
GRANT ALL ON public.kindle_deliveries TO service_role;
ALTER TABLE public.kindle_deliveries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view own Kindle deliveries"
ON public.kindle_deliveries FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "Members create own Kindle deliveries"
ON public.kindle_deliveries FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);
CREATE INDEX kindle_deliveries_user_created_idx ON public.kindle_deliveries(user_id, created_at DESC);
CREATE INDEX kindle_deliveries_provider_message_idx ON public.kindle_deliveries(provider_message_id) WHERE provider_message_id IS NOT NULL;
CREATE TRIGGER update_kindle_deliveries_updated_at
BEFORE UPDATE ON public.kindle_deliveries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();