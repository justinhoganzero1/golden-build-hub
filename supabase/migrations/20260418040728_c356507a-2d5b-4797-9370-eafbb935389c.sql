CREATE TABLE public.user_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL DEFAULT 'hostplus',
  claim_type TEXT NOT NULL DEFAULT 'income_protection',
  status TEXT NOT NULL DEFAULT 'draft',
  full_name TEXT,
  date_of_birth DATE,
  address TEXT,
  phone TEXT,
  email TEXT,
  member_number TEXT,
  employer TEXT,
  job_title TEXT,
  employment_start DATE,
  injury_date DATE,
  injury_description TEXT,
  body_parts TEXT,
  doctor_name TEXT,
  doctor_phone TEXT,
  hospital TEXT,
  workcover_claim_number TEXT,
  last_worked_date DATE,
  income_amount TEXT,
  bank_account TEXT,
  super_member_number TEXT,
  ai_draft TEXT,
  ai_research JSONB DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_claims ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own claims" ON public.user_claims FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own claims" ON public.user_claims FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own claims" ON public.user_claims FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own claims" ON public.user_claims FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_claims_updated_at
  BEFORE UPDATE ON public.user_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();