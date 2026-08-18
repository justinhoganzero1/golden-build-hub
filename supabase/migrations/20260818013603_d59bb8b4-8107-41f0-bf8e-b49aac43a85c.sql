revoke all on function public.protect_investment_offer_ai_fields() from public, anon, authenticated;
revoke all on function public.living_gifs_privileged_unchanged(public.living_gifs) from public, anon;
revoke all on function public.movie_projects_privileged_unchanged(public.movie_projects) from public, anon;
grant execute on function public.living_gifs_privileged_unchanged(public.living_gifs) to authenticated;
grant execute on function public.movie_projects_privileged_unchanged(public.movie_projects) to authenticated;