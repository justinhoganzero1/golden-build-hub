-- Personal assistant settings: stores user's own phone number so Oracle can SMS / call them
CREATE TABLE public.user_assistant_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  personal_phone text,               -- E.164 format, e.g. +14155550123
  twilio_number text,                -- the Twilio number routed to this user (E.164)
  call_answering_enabled boolean NOT NULL DEFAULT false,
  outbound_calls_enabled boolean NOT NULL DEFAULT false,
  reply_channel text NOT NULL DEFAULT 'both',  -- 'chat' | 'sms' | 'both'
  hold_message text NOT NULL DEFAULT 'One moment please, I''m muting you while I check with the owner. I''ll be right back.',
  greeting text NOT NULL DEFAULT 'Hello, this is the personal assistant. How can I help you today?',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.user_assistant_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own assistant settings"
ON public.user_assistant_settings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_assistant_settings_updated
BEFORE UPDATE ON public.user_assistant_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Live call sessions: tracks an in-progress relay between caller, Oracle, and the user
CREATE TABLE public.call_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  direction text NOT NULL,                       -- 'inbound' | 'outbound'
  twilio_call_sid text UNIQUE,
  caller_number text,                            -- the OTHER party's number
  caller_name text,
  intent text,                                   -- what the call is about (Oracle-summarised)
  status text NOT NULL DEFAULT 'ringing',        -- ringing | connected | on_hold | awaiting_user | replying | ended
  last_caller_message text,                      -- last thing the caller said (mutes them after)
  pending_user_reply text,                       -- reply user has typed/spoken, waiting to be relayed
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb, -- [{role:'caller'|'oracle'|'user', text, ts}]
  hold_started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.call_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own call sessions"
ON public.call_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users update own call sessions"
ON public.call_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Inserts and writes from the caller-side webhook happen via service role in the edge function.

CREATE INDEX idx_call_sessions_user_status ON public.call_sessions (user_id, status);
CREATE INDEX idx_call_sessions_sid ON public.call_sessions (twilio_call_sid);

CREATE TRIGGER trg_call_sessions_updated
BEFORE UPDATE ON public.call_sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime so the Oracle UI can react when a call comes in or status changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.call_sessions;
ALTER TABLE public.call_sessions REPLICA IDENTITY FULL;