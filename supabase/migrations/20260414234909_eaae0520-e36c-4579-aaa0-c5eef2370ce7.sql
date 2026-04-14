
-- Oracle persistent memory table
CREATE TABLE public.oracle_memories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  memory_type TEXT NOT NULL DEFAULT 'fact',
  content TEXT NOT NULL,
  importance INTEGER NOT NULL DEFAULT 5,
  context TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.oracle_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memories" ON public.oracle_memories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own memories" ON public.oracle_memories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own memories" ON public.oracle_memories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own memories" ON public.oracle_memories FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_oracle_memories_updated_at BEFORE UPDATE ON public.oracle_memories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_oracle_memories_user ON public.oracle_memories(user_id);
CREATE INDEX idx_oracle_memories_type ON public.oracle_memories(user_id, memory_type);

-- User ad preferences table
CREATE TABLE public.user_ad_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  ads_enabled BOOLEAN NOT NULL DEFAULT true,
  last_promo_shown_at TIMESTAMP WITH TIME ZONE,
  promo_count INTEGER NOT NULL DEFAULT 0,
  free_trials_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_ad_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ad prefs" ON public.user_ad_preferences FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own ad prefs" ON public.user_ad_preferences FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ad prefs" ON public.user_ad_preferences FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_ad_preferences_updated_at BEFORE UPDATE ON public.user_ad_preferences FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
