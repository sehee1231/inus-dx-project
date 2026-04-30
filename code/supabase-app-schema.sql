-- 모닥: Auth + Profile + Posts + Notifications 기본 스키마
-- Supabase SQL Editor에서 실행

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  cat text,
  title text,
  excerpt text,
  body text,
  link text,
  author_name text,
  author_id uuid not null references auth.users(id) on delete cascade,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

-- 기존 posts 테이블이 이미 있는 경우 컬럼 보강
alter table public.posts add column if not exists id uuid default gen_random_uuid();
alter table public.posts add column if not exists slug text;
alter table public.posts add column if not exists cat text;
alter table public.posts add column if not exists title text;
alter table public.posts add column if not exists excerpt text;
alter table public.posts add column if not exists body text;
alter table public.posts add column if not exists link text;
alter table public.posts add column if not exists author_name text;
alter table public.posts add column if not exists author_id uuid references auth.users(id) on delete cascade;
alter table public.posts add column if not exists visibility text default 'public';
alter table public.posts add column if not exists created_at timestamptz default now();
alter table public.posts add column if not exists updated_at timestamptz;

update public.posts
set visibility = 'public'
where visibility is null;

alter table public.posts
  alter column visibility set default 'public';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'posts_visibility_check'
  ) then
    alter table public.posts
      add constraint posts_visibility_check check (visibility in ('public', 'private'));
  end if;
exception when duplicate_object then
  null;
end$$;

create unique index if not exists posts_slug_key on public.posts(slug);
create index if not exists posts_author_id_idx on public.posts(author_id);
create index if not exists posts_created_at_idx on public.posts(created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  to_user_id uuid not null references auth.users(id) on delete cascade,
  from_user_id uuid references auth.users(id) on delete set null,
  post_slug text,
  type text not null default 'mention',
  message text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_to_user_id_idx on public.notifications(to_user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.notifications enable row level security;

drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all
on public.profiles for select
to anon, authenticated
using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles for insert
to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin
on public.profiles for update
to authenticated
using (
  id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists posts_select_public_or_owner_or_admin on public.posts;
create policy posts_select_public_or_owner_or_admin
on public.posts for select
to anon, authenticated
using (
  visibility = 'public'
  or author_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists posts_insert_owner_only on public.posts;
create policy posts_insert_owner_only
on public.posts for insert
to authenticated
with check (author_id = auth.uid());

drop policy if exists posts_update_owner_or_admin on public.posts;
create policy posts_update_owner_or_admin
on public.posts for update
to authenticated
using (
  author_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  author_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists posts_delete_owner_or_admin on public.posts;
create policy posts_delete_owner_or_admin
on public.posts for delete
to authenticated
using (
  author_id = auth.uid()
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists notifications_select_owner on public.notifications;
create policy notifications_select_owner
on public.notifications for select
to authenticated
using (to_user_id = auth.uid());

drop policy if exists notifications_insert_authenticated on public.notifications;
create policy notifications_insert_authenticated
on public.notifications for insert
to authenticated
with check (from_user_id = auth.uid());

drop policy if exists notifications_update_owner on public.notifications;
create policy notifications_update_owner
on public.notifications for update
to authenticated
using (to_user_id = auth.uid())
with check (to_user_id = auth.uid());
