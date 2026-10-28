create table if not exists public.payout_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  amount_cents integer not null check (amount_cents > 0),
  method text not null default 'payid',
  destination text not null,
  status text not null default 'pending' check (status in ('pending','paid','rejected')),
  admin_note text,
  created_at timestamptz not null default now(),
  processed_at timestamptz
);

create index if not exists idx_payout_requests_user on public.payout_requests(user_id);
create index if not exists idx_payout_requests_status on public.payout_requests(status);

GRANT SELECT, INSERT ON public.payout_requests TO authenticated;
GRANT ALL ON public.payout_requests TO service_role;

alter table public.payout_requests enable row level security;

create policy "Users can view own payout requests"
  on public.payout_requests for select
  using (auth.uid() = user_id);

create policy "Users can create own payout requests"
  on public.payout_requests for insert
  with check (auth.uid() = user_id);

create policy "Service role can manage payout requests"
  on public.payout_requests for all
  using (auth.role() = 'service_role');

create or replace function public.seller_available_balance(user_uuid uuid)
returns integer language sql security definer stable as $$
  select greatest(0,
    coalesce((
      select sum(creator_payout_cents) from public.shop_purchases
      where creator_id = user_uuid and status = 'paid'
    ), 0)
    + coalesce((
      select sum(price_cents) from public.founder_seat_listings
      where seller_id = user_uuid and status = 'sold'
    ), 0)
    - coalesce((
      select sum(amount_cents) from public.payout_requests
      where user_id = user_uuid and status in ('pending','paid')
    ), 0)
  );
$$;