-- =====================================================
-- MOVIE STUDIO PRO: Long-form, resumable, 8K pipeline
-- =====================================================

-- Tier enum for render quality
CREATE TYPE public.movie_quality_tier AS ENUM ('sd', 'hd', '4k', '8k_ultimate');

-- Project status
CREATE TYPE public.movie_project_status AS ENUM (
  'draft', 'chunking', 'queued', 'rendering', 'stitching',
  'mixing', 'upscaling', 'completed', 'failed', 'paused'
);

-- Scene status
CREATE TYPE public.movie_scene_status AS ENUM (
  'pending', 'rendering_video', 'rendering_audio', 'lip_syncing',
  'upscaling', 'completed', 'failed', 'skipped'
);

-- =====================================================
-- movie_projects: top-level project for each user film
-- =====================================================
CREATE TABLE public.movie_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled Movie',
  logline TEXT,
  genre TEXT,
  target_duration_minutes INTEGER NOT NULL DEFAULT 5,
  quality_tier public.movie_quality_tier NOT NULL DEFAULT 'hd',
  status public.movie_project_status NOT NULL DEFAULT 'draft',
  -- Full Oracle interview answers
  brief JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Generated assets
  full_script TEXT,
  director_intent TEXT,
  youtube_metadata JSONB DEFAULT '{}'::jsonb,
  -- Cost tracking
  estimated_cost_cents INTEGER DEFAULT 0,
  spent_cost_cents INTEGER DEFAULT 0,
  user_paid_cents INTEGER DEFAULT 0,
  -- Final output
  final_video_url TEXT,
  thumbnail_url TEXT,
  trailer_url TEXT,
  youtube_video_id TEXT,
  -- Progress
  total_scenes INTEGER DEFAULT 0,
  completed_scenes INTEGER DEFAULT 0,
  failed_scenes INTEGER DEFAULT 0,
  -- Errors
  last_error TEXT,
  error_count INTEGER DEFAULT 0,
  -- Timestamps
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_movie_projects_user ON public.movie_projects(user_id);
CREATE INDEX idx_movie_projects_status ON public.movie_projects(status);

ALTER TABLE public.movie_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own projects" ON public.movie_projects
  FOR SELECT USING (auth.uid() = user_id OR public.is_owner());
CREATE POLICY "Users create own projects" ON public.movie_projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own projects" ON public.movie_projects
  FOR UPDATE USING (auth.uid() = user_id OR public.is_owner());
CREATE POLICY "Users delete own projects" ON public.movie_projects
  FOR DELETE USING (auth.uid() = user_id OR public.is_owner());

CREATE TRIGGER movie_projects_updated
  BEFORE UPDATE ON public.movie_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- movie_character_bible: locked seeds for consistency
-- =====================================================
CREATE TABLE public.movie_character_bible (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  visual_seed TEXT, -- locked physical description for image gen
  wardrobe TEXT,
  voice_id TEXT, -- ElevenLabs voice ID
  voice_name TEXT,
  reference_image_url TEXT,
  personality TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_character_bible_project ON public.movie_character_bible(project_id);

ALTER TABLE public.movie_character_bible ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own characters" ON public.movie_character_bible
  FOR SELECT USING (auth.uid() = user_id OR public.is_owner());
CREATE POLICY "Users manage own characters" ON public.movie_character_bible
  FOR ALL USING (auth.uid() = user_id OR public.is_owner())
  WITH CHECK (auth.uid() = user_id OR public.is_owner());

CREATE TRIGGER movie_character_bible_updated
  BEFORE UPDATE ON public.movie_character_bible
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- movie_scenes: each renderable scene
-- =====================================================
CREATE TABLE public.movie_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  scene_number INTEGER NOT NULL,
  -- Content
  script_text TEXT NOT NULL,
  visual_prompt TEXT,
  location TEXT,
  time_of_day TEXT,
  mood TEXT,
  duration_seconds NUMERIC(6,2) NOT NULL DEFAULT 5,
  characters TEXT[] DEFAULT ARRAY[]::TEXT[],
  dialogue JSONB DEFAULT '[]'::jsonb, -- [{character, line, voice_id}]
  -- Render outputs
  video_1080p_url TEXT,
  video_4k_url TEXT,
  video_8k_url TEXT,
  audio_url TEXT,
  music_url TEXT,
  sfx_url TEXT,
  lipsync_url TEXT,
  final_scene_url TEXT,
  -- State
  status public.movie_scene_status NOT NULL DEFAULT 'pending',
  retry_count INTEGER DEFAULT 0,
  last_error TEXT,
  -- Cost
  provider_cost_cents INTEGER DEFAULT 0,
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, scene_number)
);

CREATE INDEX idx_movie_scenes_project ON public.movie_scenes(project_id, scene_number);
CREATE INDEX idx_movie_scenes_status ON public.movie_scenes(status);
CREATE INDEX idx_movie_scenes_pending ON public.movie_scenes(project_id) WHERE status = 'pending';

ALTER TABLE public.movie_scenes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own scenes" ON public.movie_scenes
  FOR SELECT USING (auth.uid() = user_id OR public.is_owner());
CREATE POLICY "Users manage own scenes" ON public.movie_scenes
  FOR ALL USING (auth.uid() = user_id OR public.is_owner())
  WITH CHECK (auth.uid() = user_id OR public.is_owner());

CREATE TRIGGER movie_scenes_updated
  BEFORE UPDATE ON public.movie_scenes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- movie_render_jobs: queue rows the cron worker reads
-- =====================================================
CREATE TABLE public.movie_render_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.movie_projects(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES public.movie_scenes(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  job_type TEXT NOT NULL, -- 'video' | 'audio' | 'lipsync' | 'upscale_4k' | 'upscale_8k' | 'stitch' | 'mix' | 'thumbnail' | 'trailer'
  priority INTEGER DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | running | completed | failed | cancelled
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  payload JSONB DEFAULT '{}'::jsonb,
  result JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  locked_at TIMESTAMPTZ,
  locked_by TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_render_jobs_queue ON public.movie_render_jobs(status, scheduled_for, priority) WHERE status = 'queued';
CREATE INDEX idx_render_jobs_project ON public.movie_render_jobs(project_id);
CREATE INDEX idx_render_jobs_user ON public.movie_render_jobs(user_id);

ALTER TABLE public.movie_render_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own jobs" ON public.movie_render_jobs
  FOR SELECT USING (auth.uid() = user_id OR public.is_owner());
CREATE POLICY "Users insert own jobs" ON public.movie_render_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Service updates jobs" ON public.movie_render_jobs
  FOR UPDATE USING (public.is_owner());

CREATE TRIGGER movie_render_jobs_updated
  BEFORE UPDATE ON public.movie_render_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- Atomic job claim (cron worker calls this)
-- =====================================================
CREATE OR REPLACE FUNCTION public.claim_next_render_job(_worker_id TEXT)
RETURNS TABLE (
  job_id UUID,
  project_id UUID,
  scene_id UUID,
  user_id UUID,
  job_type TEXT,
  payload JSONB,
  attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_job_id UUID;
BEGIN
  -- Pick & lock the highest priority queued job
  SELECT id INTO v_job_id
  FROM public.movie_render_jobs
  WHERE status = 'queued'
    AND scheduled_for <= now()
    AND attempts < max_attempts
  ORDER BY priority ASC, scheduled_for ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_job_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.movie_render_jobs
  SET status = 'running',
      locked_at = now(),
      locked_by = _worker_id,
      started_at = COALESCE(started_at, now()),
      attempts = attempts + 1,
      updated_at = now()
  WHERE id = v_job_id;

  RETURN QUERY
  SELECT j.id, j.project_id, j.scene_id, j.user_id, j.job_type, j.payload, j.attempts
  FROM public.movie_render_jobs j
  WHERE j.id = v_job_id;
END;
$$;

-- =====================================================
-- Mark project progress when scene finishes
-- =====================================================
CREATE OR REPLACE FUNCTION public.recalc_project_progress(_project_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER;
  v_done INTEGER;
  v_failed INTEGER;
BEGIN
  SELECT COUNT(*),
         COUNT(*) FILTER (WHERE status = 'completed'),
         COUNT(*) FILTER (WHERE status = 'failed')
  INTO v_total, v_done, v_failed
  FROM public.movie_scenes WHERE project_id = _project_id;

  UPDATE public.movie_projects
  SET total_scenes = v_total,
      completed_scenes = v_done,
      failed_scenes = v_failed,
      updated_at = now()
  WHERE id = _project_id;
END;
$$;
