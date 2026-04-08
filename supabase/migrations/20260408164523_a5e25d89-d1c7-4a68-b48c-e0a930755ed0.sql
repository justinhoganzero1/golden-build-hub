
-- User avatars table for persistent avatar choices
CREATE TABLE public.user_avatars (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'My Avatar',
  purpose TEXT NOT NULL DEFAULT 'oracle',
  voice_style TEXT DEFAULT 'Warm & Friendly',
  personality TEXT DEFAULT 'Sweet & Caring',
  image_url TEXT,
  art_style TEXT DEFAULT 'realistic-full',
  description TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own avatars" ON public.user_avatars FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own avatars" ON public.user_avatars FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own avatars" ON public.user_avatars FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own avatars" ON public.user_avatars FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_avatars_updated_at
  BEFORE UPDATE ON public.user_avatars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User media library table
CREATE TABLE public.user_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'image',
  title TEXT,
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  source_page TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.user_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own media" ON public.user_media FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own media" ON public.user_media FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own media" ON public.user_media FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own media" ON public.user_media FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_user_media_updated_at
  BEFORE UPDATE ON public.user_media
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
