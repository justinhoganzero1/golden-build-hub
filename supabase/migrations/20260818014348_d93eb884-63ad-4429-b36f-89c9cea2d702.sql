create or replace function public.retry_failed_scene(_scene_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_scene record;
begin
  select s.*, p.user_id as project_user_id
    into v_scene
  from public.movie_scenes s
  join public.movie_projects p on p.id = s.project_id
  where s.id = _scene_id;

  if not found then
    return false;
  end if;

  if v_scene.project_user_id <> auth.uid() and not public.is_owner() then
    return false;
  end if;

  -- Never queue a second job for a scene that already has one in flight:
  -- a duplicate job would re-run the provider and bill the user twice.
  if exists (
    select 1 from public.movie_render_jobs
    where scene_id = _scene_id
      and status in ('queued', 'running')
  ) then
    return false;
  end if;

  update public.movie_scenes
     set status = 'pending', error_message = null, updated_at = now()
   where id = _scene_id;

  insert into public.movie_render_jobs (project_id, scene_id, user_id, job_type, priority)
  values (v_scene.project_id, _scene_id, v_scene.project_user_id, 'video', 50);

  return true;
end;
$$;

revoke all on function public.retry_failed_scene(uuid) from public, anon;
grant execute on function public.retry_failed_scene(uuid) to authenticated;