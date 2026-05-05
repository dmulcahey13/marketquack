create extension if not exists pgcrypto;

create table if not exists public.practice_portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  starting_balance numeric(18, 4) not null check (starting_balance > 0),
  cash_balance numeric(18, 4) not null check (cash_balance >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists public.practice_holdings (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.practice_portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null check (ticker = upper(ticker)),
  shares numeric(18, 6) not null check (shares > 0),
  avg_price numeric(18, 4) not null check (avg_price >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (portfolio_id, ticker)
);

create table if not exists public.practice_transactions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.practice_portfolios(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null check (ticker = upper(ticker)),
  transaction_type text not null check (transaction_type in ('buy', 'sell')),
  shares numeric(18, 6) not null check (shares > 0),
  price numeric(18, 4) not null check (price >= 0),
  total_value numeric(18, 4) not null check (total_value >= 0),
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_practice_portfolios_updated_at on public.practice_portfolios;
create trigger set_practice_portfolios_updated_at
before update on public.practice_portfolios
for each row execute function public.set_updated_at();

drop trigger if exists set_practice_holdings_updated_at on public.practice_holdings;
create trigger set_practice_holdings_updated_at
before update on public.practice_holdings
for each row execute function public.set_updated_at();

alter table public.practice_portfolios enable row level security;
alter table public.practice_holdings enable row level security;
alter table public.practice_transactions enable row level security;

drop policy if exists "Users can select their practice portfolios" on public.practice_portfolios;
create policy "Users can select their practice portfolios"
on public.practice_portfolios
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their practice portfolios" on public.practice_portfolios;
create policy "Users can insert their practice portfolios"
on public.practice_portfolios
for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their practice portfolios" on public.practice_portfolios;
create policy "Users can update their practice portfolios"
on public.practice_portfolios
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their practice portfolios" on public.practice_portfolios;
create policy "Users can delete their practice portfolios"
on public.practice_portfolios
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can select their practice holdings" on public.practice_holdings;
create policy "Users can select their practice holdings"
on public.practice_holdings
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their practice holdings" on public.practice_holdings;
create policy "Users can insert their practice holdings"
on public.practice_holdings
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.practice_portfolios
    where practice_portfolios.id = practice_holdings.portfolio_id
      and practice_portfolios.user_id = auth.uid()
  )
);

drop policy if exists "Users can update their practice holdings" on public.practice_holdings;
create policy "Users can update their practice holdings"
on public.practice_holdings
for update
using (auth.uid() = user_id)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.practice_portfolios
    where practice_portfolios.id = practice_holdings.portfolio_id
      and practice_portfolios.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete their practice holdings" on public.practice_holdings;
create policy "Users can delete their practice holdings"
on public.practice_holdings
for delete
using (auth.uid() = user_id);

drop policy if exists "Users can select their practice transactions" on public.practice_transactions;
create policy "Users can select their practice transactions"
on public.practice_transactions
for select
using (auth.uid() = user_id);

drop policy if exists "Users can insert their practice transactions" on public.practice_transactions;
create policy "Users can insert their practice transactions"
on public.practice_transactions
for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.practice_portfolios
    where practice_portfolios.id = practice_transactions.portfolio_id
      and practice_portfolios.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete their practice transactions" on public.practice_transactions;
create policy "Users can delete their practice transactions"
on public.practice_transactions
for delete
using (auth.uid() = user_id);
