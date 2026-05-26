create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

drop policy if exists "read own admin marker" on public.admin_users;
create policy "read own admin marker"
on public.admin_users
for select
using (lower(email) = lower((auth.jwt() ->> 'email')));

create table if not exists public.public_sites (
  id text primary key,
  name text not null,
  url text not null,
  category text not null,
  tags text[] not null default '{}'::text[],
  icon text not null default '',
  description text not null default '',
  aliases text[] not null default '{}'::text[],
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists public_sites_category_sort_idx
on public.public_sites (category, sort_order, created_at desc);

alter table public.public_sites enable row level security;

drop policy if exists "read public sites" on public.public_sites;
create policy "read public sites"
on public.public_sites
for select
using (true);

drop policy if exists "insert public sites as admin" on public.public_sites;
create policy "insert public sites as admin"
on public.public_sites
for insert
with check (exists (
  select 1 from public.admin_users
  where lower(admin_users.email) = lower((auth.jwt() ->> 'email'))
));

drop policy if exists "update public sites as admin" on public.public_sites;
create policy "update public sites as admin"
on public.public_sites
for update
using (exists (
  select 1 from public.admin_users
  where lower(admin_users.email) = lower((auth.jwt() ->> 'email'))
))
with check (exists (
  select 1 from public.admin_users
  where lower(admin_users.email) = lower((auth.jwt() ->> 'email'))
));

drop policy if exists "delete public sites as admin" on public.public_sites;
create policy "delete public sites as admin"
on public.public_sites
for delete
using (exists (
  select 1 from public.admin_users
  where lower(admin_users.email) = lower((auth.jwt() ->> 'email'))
));
