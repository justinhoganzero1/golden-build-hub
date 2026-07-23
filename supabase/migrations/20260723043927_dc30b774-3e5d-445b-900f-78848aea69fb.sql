
-- 1) Drop redundant no-op deny policy on suggestions
DROP POLICY IF EXISTS "Users cannot directly update suggestions" ON public.suggestions;

-- 2) Harden INSERT policies on living_gifs and movie_projects with WITH CHECK
DROP POLICY IF EXISTS "Users create own living gifs" ON public.living_gifs;
CREATE POLICY "Users create own living gifs"
ON public.living_gifs
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.is_owner()
    OR (
      COALESCE(status, 'pending_payment') IN ('pending_payment','queued','draft')
      AND COALESCE(amount_paid_cents, 0) = 0
      AND COALESCE(is_public, false) = false
      AND stripe_session_id IS NULL
      AND stripe_payment_intent IS NULL
      AND gif_url IS NULL
      AND preview_mp4_url IS NULL
      AND generated_at IS NULL
      AND runway_task_id IS NULL
      AND replicate_prediction_id IS NULL
      AND COALESCE(attempts, 0) = 0
      AND COALESCE(download_count, 0) = 0
      AND COALESCE(view_count, 0) = 0
      AND error_message IS NULL
    )
  )
);

DROP POLICY IF EXISTS "Users create own projects" ON public.movie_projects;
CREATE POLICY "Users create own projects"
ON public.movie_projects
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.is_owner()
    OR (
      COALESCE(payment_status, 'pending') = 'pending'
      AND COALESCE(user_paid_cents, 0) = 0
      AND COALESCE(spent_cost_cents, 0) = 0
      AND stripe_session_id IS NULL
      AND stripe_payment_intent IS NULL
      AND paid_at IS NULL
      AND final_video_url IS NULL
      AND trailer_url IS NULL
      AND thumbnail_url IS NULL
      AND youtube_video_id IS NULL
      AND shotstack_render_id IS NULL
      AND shotstack_status IS NULL
      AND thumbnail_status IS NULL
      AND trailer_status IS NULL
      AND COALESCE(status, 'draft') = 'draft'
      AND COALESCE(completed_scenes, 0) = 0
      AND COALESCE(failed_scenes, 0) = 0
      AND COALESCE(error_count, 0) = 0
      AND started_at IS NULL
      AND completed_at IS NULL
      AND COALESCE(download_count, 0) = 0
      AND COALESCE(view_count, 0) = 0
    )
  )
);
