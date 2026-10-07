CREATE TABLE public.user_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  model text NOT NULL,
  personality text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_agents TO authenticated;
GRANT ALL ON public.user_agents TO service_role;
ALTER TABLE public.user_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own agents" ON public.user_agents FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.agent_chats (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  scope text NOT NULL,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, scope)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_chats TO authenticated;
GRANT ALL ON public.agent_chats TO service_role;
ALTER TABLE public.agent_chats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chats" ON public.agent_chats FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.agent_stats (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  agent_key text NOT NULL,
  replies integer NOT NULL DEFAULT 0,
  words integer NOT NULL DEFAULT 0,
  cents_est numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, agent_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_stats TO authenticated;
GRANT ALL ON public.agent_stats TO service_role;
ALTER TABLE public.agent_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own stats" ON public.agent_stats FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.book_goals (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  story_id uuid NOT NULL,
  target_score integer NOT NULL DEFAULT 9,
  current_score integer,
  notes text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.book_goals TO authenticated;
GRANT ALL ON public.book_goals TO service_role;
ALTER TABLE public.book_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own goals" ON public.book_goals FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);