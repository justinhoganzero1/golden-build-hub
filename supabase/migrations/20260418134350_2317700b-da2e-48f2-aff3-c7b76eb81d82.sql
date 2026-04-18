create table if not exists public.connect_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  stripe_account_id text not null unique,
  display_name text,
  contact_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.connect_accounts enable row level security;

create policy "Users view own connect account"
  on public.connect_accounts for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Owner views all connect accounts"
  on public.connect_accounts for select
  to authenticated
  using (public.is_owner());

create trigger update_connect_accounts_updated_at
  before update on public.connect_accounts
  for each row execute function public.update_updated_at_column();