create or replace function public.protect_billing_budget_ceilings()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_owner() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.max_daily_limit_cents := 20000;
    new.max_monthly_limit_cents := 200000;
    new.hard_stop := true;
  else
    new.max_daily_limit_cents := old.max_daily_limit_cents;
    new.max_monthly_limit_cents := old.max_monthly_limit_cents;
    new.hard_stop := old.hard_stop;
  end if;

  new.daily_limit_cents := least(greatest(coalesce(new.daily_limit_cents, 0), 0), new.max_daily_limit_cents);
  new.monthly_limit_cents := least(greatest(coalesce(new.monthly_limit_cents, 0), 0), new.max_monthly_limit_cents);
  new.auto_topup_threshold_cents := least(greatest(coalesce(new.auto_topup_threshold_cents, 500), 0), 20000);
  new.auto_topup_pack_cents := least(greatest(coalesce(new.auto_topup_pack_cents, 2000), 100), 50000);
  new.low_balance_alert_cents := least(greatest(coalesce(new.low_balance_alert_cents, 500), 0), 50000);

  return new;
end;
$$;

drop trigger if exists trg_protect_billing_budget_ceilings on public.billing_budgets;
create trigger trg_protect_billing_budget_ceilings
before insert or update on public.billing_budgets
for each row execute function public.protect_billing_budget_ceilings();

drop policy if exists "Users create own billing budget" on public.billing_budgets;
create policy "Users create own billing budget"
on public.billing_budgets for insert to authenticated
with check (
  auth.uid() = user_id
  and daily_limit_cents between 0 and max_daily_limit_cents
  and monthly_limit_cents between 0 and max_monthly_limit_cents
  and auto_topup_threshold_cents between 0 and 20000
  and auto_topup_pack_cents between 100 and 50000
);

drop policy if exists "Users update own billing budget" on public.billing_budgets;
create policy "Users update own billing budget"
on public.billing_budgets for update to authenticated
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and daily_limit_cents between 0 and max_daily_limit_cents
  and monthly_limit_cents between 0 and max_monthly_limit_cents
  and auto_topup_threshold_cents between 0 and 20000
  and auto_topup_pack_cents between 100 and 50000
);

revoke execute on function public.protect_billing_budget_ceilings() from public, anon, authenticated;