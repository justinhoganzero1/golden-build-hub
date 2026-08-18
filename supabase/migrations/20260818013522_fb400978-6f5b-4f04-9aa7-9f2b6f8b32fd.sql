drop policy if exists "Anyone signed in can read agent controls" on public.agent_controls;
create policy "Only owner reads agent controls"
on public.agent_controls for select to authenticated
using (public.is_owner() or public.has_role(auth.uid(), 'admin'));

revoke all on function public.protect_investment_offer_ai_fields() from anon, authenticated;

create or replace function public.living_gifs_privileged_unchanged(_new public.living_gifs)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.living_gifs o
    where o.id = _new.id
      and o.user_id is not distinct from _new.user_id
      and o.status is not distinct from _new.status
      and o.amount_paid_cents is not distinct from _new.amount_paid_cents
      and o.stripe_session_id is not distinct from _new.stripe_session_id
      and o.stripe_payment_intent is not distinct from _new.stripe_payment_intent
      and o.gif_url is not distinct from _new.gif_url
      and o.preview_mp4_url is not distinct from _new.preview_mp4_url
      and o.generated_at is not distinct from _new.generated_at
      and o.runway_task_id is not distinct from _new.runway_task_id
      and o.replicate_prediction_id is not distinct from _new.replicate_prediction_id
      and o.attempts is not distinct from _new.attempts
      and o.download_count is not distinct from _new.download_count
      and o.view_count is not distinct from _new.view_count
  )
$$;
grant execute on function public.living_gifs_privileged_unchanged(public.living_gifs) to authenticated;

drop policy if exists "Users update own living gifs" on public.living_gifs;
create policy "Users update own living gifs"
on public.living_gifs for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and (public.is_owner() or public.living_gifs_privileged_unchanged(living_gifs))
);

create or replace function public.movie_projects_privileged_unchanged(_new public.movie_projects)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.movie_projects o
    where o.id = _new.id
      and o.user_id is not distinct from _new.user_id
      and o.payment_status is not distinct from _new.payment_status
      and o.user_paid_cents is not distinct from _new.user_paid_cents
      and o.spent_cost_cents is not distinct from _new.spent_cost_cents
      and o.stripe_session_id is not distinct from _new.stripe_session_id
      and o.stripe_payment_intent is not distinct from _new.stripe_payment_intent
      and o.paid_at is not distinct from _new.paid_at
      and o.final_video_url is not distinct from _new.final_video_url
      and o.trailer_url is not distinct from _new.trailer_url
      and o.thumbnail_url is not distinct from _new.thumbnail_url
      and o.youtube_video_id is not distinct from _new.youtube_video_id
      and o.shotstack_render_id is not distinct from _new.shotstack_render_id
      and o.shotstack_status is not distinct from _new.shotstack_status
      and o.status is not distinct from _new.status
      and o.completed_scenes is not distinct from _new.completed_scenes
      and o.failed_scenes is not distinct from _new.failed_scenes
      and o.error_count is not distinct from _new.error_count
      and o.download_count is not distinct from _new.download_count
      and o.view_count is not distinct from _new.view_count
  )
$$;
grant execute on function public.movie_projects_privileged_unchanged(public.movie_projects) to authenticated;

drop policy if exists "Users update own projects" on public.movie_projects;
create policy "Users update own projects"
on public.movie_projects for update to authenticated
using (auth.uid() = user_id or public.is_owner())
with check (
  (auth.uid() = user_id or public.is_owner())
  and (public.is_owner() or public.movie_projects_privileged_unchanged(movie_projects))
);