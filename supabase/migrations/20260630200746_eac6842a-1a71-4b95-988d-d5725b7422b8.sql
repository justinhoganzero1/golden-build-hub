
-- ============ Voice Agent Config (single row) ============
CREATE TABLE public.voice_agent_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  greeting TEXT NOT NULL DEFAULT 'Hi, thanks for calling Oracle Lunar. How can I help you today?',
  system_prompt TEXT NOT NULL DEFAULT 'You are a friendly, professional AI receptionist for Oracle Lunar. Answer FAQs from the knowledge base, qualify the caller (name, phone, reason), and offer to book an appointment. Keep responses under 25 words. If the caller is angry, asks for a refund, mentions legal action, or asks for the owner, say "Let me transfer you to a person" and emit handoff intent.',
  voice_id TEXT NOT NULL DEFAULT '21m00Tcm4TlvDq8ikWAM',
  language TEXT NOT NULL DEFAULT 'en-US',
  business_hours JSONB NOT NULL DEFAULT '{"mon":["09:00","17:00"],"tue":["09:00","17:00"],"wed":["09:00","17:00"],"thu":["09:00","17:00"],"fri":["09:00","17:00"],"sat":null,"sun":null,"timezone":"Australia/Sydney"}'::jsonb,
  handoff_number TEXT,
  fallback_voicemail_url TEXT,
  twilio_phone_number TEXT,
  booking_duration_minutes INTEGER NOT NULL DEFAULT 30,
  booking_calendar_id TEXT DEFAULT 'primary',
  google_calendar_enabled BOOLEAN NOT NULL DEFAULT false,
  external_webhook_url TEXT,
  missed_call_sms TEXT NOT NULL DEFAULT 'Sorry we missed your call! This is Oracle Lunar — reply here and we''ll get right back to you.',
  drip_24h_sms TEXT NOT NULL DEFAULT 'Hi again — just checking in. Still happy to help whenever you''re ready.',
  drip_72h_sms TEXT NOT NULL DEFAULT 'Last check-in from Oracle Lunar — reply STOP to opt out.',
  handoff_rules JSONB NOT NULL DEFAULT '[{"trigger":"intent","value":"complaint","action":"transfer"},{"trigger":"intent","value":"refund","action":"transfer"}]'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_agent_config TO authenticated;
GRANT ALL ON public.voice_agent_config TO service_role;
ALTER TABLE public.voice_agent_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all_agent_config" ON public.voice_agent_config FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER trg_voice_agent_config_updated BEFORE UPDATE ON public.voice_agent_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Voice Knowledge Items ============
CREATE TABLE public.voice_knowledge_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  tags TEXT[] DEFAULT '{}',
  priority INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_knowledge_items TO authenticated;
GRANT ALL ON public.voice_knowledge_items TO service_role;
ALTER TABLE public.voice_knowledge_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all_knowledge" ON public.voice_knowledge_items FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER trg_voice_knowledge_updated BEFORE UPDATE ON public.voice_knowledge_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Voice Call Logs ============
CREATE TABLE public.voice_call_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid TEXT UNIQUE,
  from_number TEXT,
  to_number TEXT,
  direction TEXT NOT NULL DEFAULT 'inbound',
  status TEXT NOT NULL DEFAULT 'in-progress',
  duration_seconds INTEGER DEFAULT 0,
  transcript JSONB NOT NULL DEFAULT '[]'::jsonb,
  intent TEXT,
  outcome TEXT,
  recording_url TEXT,
  contact_id UUID,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.voice_call_logs TO authenticated;
GRANT ALL ON public.voice_call_logs TO service_role;
ALTER TABLE public.voice_call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all_calls" ON public.voice_call_logs FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE INDEX idx_voice_calls_from ON public.voice_call_logs(from_number);
CREATE INDEX idx_voice_calls_started ON public.voice_call_logs(started_at DESC);
CREATE TRIGGER trg_voice_calls_updated BEFORE UPDATE ON public.voice_call_logs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CRM Pipeline Stages ============
CREATE TABLE public.crm_pipeline_stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#fbbf24',
  is_won BOOLEAN NOT NULL DEFAULT false,
  is_lost BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_pipeline_stages TO authenticated;
GRANT ALL ON public.crm_pipeline_stages TO service_role;
ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all_stages" ON public.crm_pipeline_stages FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE TRIGGER trg_crm_stages_updated BEFORE UPDATE ON public.crm_pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CRM Contacts ============
CREATE TABLE public.crm_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT,
  email TEXT,
  name TEXT,
  tags TEXT[] DEFAULT '{}',
  stage_id UUID REFERENCES public.crm_pipeline_stages(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'voice_call',
  notes TEXT,
  last_contact_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_contacts TO authenticated;
GRANT ALL ON public.crm_contacts TO service_role;
ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all_contacts" ON public.crm_contacts FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE UNIQUE INDEX idx_crm_contacts_phone ON public.crm_contacts(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_crm_contacts_stage ON public.crm_contacts(stage_id);
CREATE TRIGGER trg_crm_contacts_updated BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CRM Activities ============
CREATE TABLE public.crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  activity_type TEXT NOT NULL,
  channel TEXT,
  subject TEXT,
  body TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'completed',
  occurs_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_activities TO authenticated;
GRANT ALL ON public.crm_activities TO service_role;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all_activities" ON public.crm_activities FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE INDEX idx_crm_activities_contact ON public.crm_activities(contact_id, occurs_at DESC);
CREATE TRIGGER trg_crm_activities_updated BEFORE UPDATE ON public.crm_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CRM Follow-ups ============
CREATE TABLE public.crm_followups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  body TEXT NOT NULL,
  subject TEXT,
  send_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'scheduled',
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_followups TO authenticated;
GRANT ALL ON public.crm_followups TO service_role;
ALTER TABLE public.crm_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_all_followups" ON public.crm_followups FOR ALL TO authenticated
  USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE INDEX idx_crm_followups_pending ON public.crm_followups(send_at) WHERE status = 'scheduled';
CREATE TRIGGER trg_crm_followups_updated BEFORE UPDATE ON public.crm_followups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ Seed default pipeline + agent config ============
INSERT INTO public.voice_agent_config (singleton) VALUES (true) ON CONFLICT DO NOTHING;

INSERT INTO public.crm_pipeline_stages (name, position, color, is_won, is_lost) VALUES
  ('New Lead', 0, '#60a5fa', false, false),
  ('Contacted', 1, '#a78bfa', false, false),
  ('Qualified', 2, '#fbbf24', false, false),
  ('Booked', 3, '#34d399', false, false),
  ('Won', 4, '#10b981', true, false),
  ('Lost', 5, '#ef4444', false, true)
ON CONFLICT DO NOTHING;

INSERT INTO public.voice_knowledge_items (question, answer, priority) VALUES
  ('What are your hours?', 'We are open Monday through Friday, 9am to 5pm Sydney time.', 100),
  ('Where are you located?', 'We are a fully online AI companion service. Visit oracle-lunar.online.', 90),
  ('How much does it cost?', 'We have a free tier and pay-as-you-go credits — 5.3 credits for one dollar. No subscriptions required.', 80)
ON CONFLICT DO NOTHING;
