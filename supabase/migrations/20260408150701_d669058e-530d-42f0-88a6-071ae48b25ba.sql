
-- Suggestions table
CREATE TABLE public.suggestions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'Feature',
  suggestion TEXT NOT NULL,
  ai_response TEXT,
  ai_quality_score INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  granted_free_access BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can create suggestions" ON public.suggestions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view own suggestions" ON public.suggestions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own suggestions" ON public.suggestions FOR UPDATE USING (auth.uid() = user_id);

-- Special occasions table  
CREATE TABLE public.special_occasions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  occasion_date DATE NOT NULL,
  category TEXT DEFAULT 'birthday',
  notes TEXT,
  remind_days_before INTEGER DEFAULT 7,
  icon TEXT DEFAULT '🎂',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.special_occasions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own occasions" ON public.special_occasions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Referrals table
CREATE TABLE public.referrals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referred_email TEXT NOT NULL,
  referral_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reward_granted BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id);
CREATE POLICY "Users can create referrals" ON public.referrals FOR INSERT WITH CHECK (auth.uid() = referrer_id);

-- Updated_at triggers
CREATE TRIGGER update_suggestions_updated_at BEFORE UPDATE ON public.suggestions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_occasions_updated_at BEFORE UPDATE ON public.special_occasions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
