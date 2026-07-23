
-- Fix movie_render_jobs INSERT to validate project/scene ownership
DROP POLICY IF EXISTS "Users insert own jobs" ON public.movie_render_jobs;
CREATE POLICY "Users insert own jobs" ON public.movie_render_jobs
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    project_id IS NULL
    OR EXISTS (SELECT 1 FROM public.movie_projects p WHERE p.id = project_id AND p.user_id = auth.uid())
  )
  AND (
    scene_id IS NULL
    OR EXISTS (SELECT 1 FROM public.movie_scenes s WHERE s.id = scene_id AND s.user_id = auth.uid())
  )
);

-- Revoke anon EXECUTE from SECURITY DEFINER helpers not intended for anonymous users
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_anon_visitor(uuid) FROM anon;
