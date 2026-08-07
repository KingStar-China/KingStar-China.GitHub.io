begin;

create table if not exists public.admin_users (
  email text primary key,
  user_id uuid unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admin_users
add column if not exists user_id uuid;

update public.admin_users as admin_user
set user_id = auth_user.id
from auth.users as auth_user
where admin_user.user_id is null
  and lower(auth_user.email) = lower(admin_user.email);

do $$
begin
  if exists (select 1 from public.admin_users where user_id is null) then
    raise exception 'Cannot migrate admin_users: create the matching Auth user first.';
  end if;
end
$$;

alter table public.admin_users
alter column user_id set not null;

create unique index if not exists admin_users_user_id_uidx
on public.admin_users (user_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_users_user_id_fkey'
      and conrelid = 'public.admin_users'::regclass
  ) then
    alter table public.admin_users
    add constraint admin_users_user_id_fkey
    foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$$;

alter table public.admin_users enable row level security;

drop policy if exists "read own admin marker" on public.admin_users;
create policy "read own admin marker"
on public.admin_users
for select
to authenticated
using ((select auth.uid()) = user_id);

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
to anon, authenticated
using (true);

drop policy if exists "insert public sites as admin" on public.public_sites;
create policy "insert public sites as admin"
on public.public_sites
for insert
to authenticated
with check (exists (
  select 1 from public.admin_users
  where admin_users.user_id = (select auth.uid())
));

drop policy if exists "update public sites as admin" on public.public_sites;
create policy "update public sites as admin"
on public.public_sites
for update
to authenticated
using (exists (
  select 1 from public.admin_users
  where admin_users.user_id = (select auth.uid())
))
with check (exists (
  select 1 from public.admin_users
  where admin_users.user_id = (select auth.uid())
));

drop policy if exists "delete public sites as admin" on public.public_sites;
create policy "delete public sites as admin"
on public.public_sites
for delete
to authenticated
using (exists (
  select 1 from public.admin_users
  where admin_users.user_id = (select auth.uid())
));

commit;
