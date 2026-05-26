create table if not exists public.user_sites (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  url text not null,
  category text not null default '个人',
  tags text[] not null default '{}'::text[],
  aliases text[] not null default '{}'::text[],
  icon text not null default '',
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_sites_user_id_idx on public.user_sites (user_id);

alter table public.user_sites enable row level security;

drop policy if exists "read own user sites" on public.user_sites;
create policy "read own user sites"
on public.user_sites
for select
using ((select auth.uid()) = user_id);

drop policy if exists "insert own user sites" on public.user_sites;
create policy "insert own user sites"
on public.user_sites
for insert
with check ((select auth.uid()) = user_id);

drop policy if exists "update own user sites" on public.user_sites;
create policy "update own user sites"
on public.user_sites
for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "delete own user sites" on public.user_sites;
create policy "delete own user sites"
on public.user_sites
for delete
using ((select auth.uid()) = user_id);
