CREATE TABLE public.saved_voices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  gender TEXT DEFAULT 'Male',
  accent TEXT,
  profession TEXT,
  voice_style TEXT,
  source TEXT NOT NULL DEFAULT 'library',
  voice_config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own voices" ON public.saved_voices FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own voices" ON public.saved_voices FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own voices" ON public.saved_voices FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own voices" ON public.saved_voices FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_saved_voices_updated_at BEFORE UPDATE ON public.saved_voices FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();