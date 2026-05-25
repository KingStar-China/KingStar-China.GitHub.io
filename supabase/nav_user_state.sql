create table if not exists public.nav_user_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.nav_user_state enable row level security;

drop policy if exists "read own nav state" on public.nav_user_state;
create policy "read own nav state"
on public.nav_user_state
for select
using (auth.uid() = user_id);

drop policy if exists "insert own nav state" on public.nav_user_state;
create policy "insert own nav state"
on public.nav_user_state
for insert
with check (auth.uid() = user_id);

drop policy if exists "update own nav state" on public.nav_user_state;
create policy "update own nav state"
on public.nav_user_state
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
