-- 모닥: Auth + Profile + Posts + Notifications 기본 스키마
-- Supabase SQL Editor에서 실행

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  approval_status text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists approval_status text;
alter table public.profiles alter column approval_status set default 'pending';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_approval_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_approval_status_check
      check (approval_status in ('pending', 'approved', 'rejected'));
  end if;
exception when duplicate_object then null;
end$$;

update public.profiles set approval_status = 'pending' where approval_status is null;
alter table public.profiles alter column approval_status set not null;

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

create table if not exists public.email_jobs (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid references public.notifications(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  template text not null default 'mention',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  created_by uuid not null references auth.users(id) on delete cascade default auth.uid(),
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index if not exists email_jobs_status_idx on public.email_jobs(status, created_at);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.notifications enable row level security;
alter table public.email_jobs enable row level security;

drop policy if exists profiles_select_all on public.profiles;
create policy profiles_select_all
on public.profiles for select
to anon, authenticated
using (true);

drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles for insert
to authenticated
with check (
  id = auth.uid()
  and coalesce(approval_status, 'pending') = 'pending'
);

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
  (
    visibility = 'public'
    and (
      auth.uid() is null
      or exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and (p.approval_status = 'approved' or p.role = 'admin')
      )
    )
  )
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
with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.approval_status = 'approved' or p.role = 'admin')
  )
);

drop policy if exists posts_update_owner_or_admin on public.posts;
create policy posts_update_owner_or_admin
on public.posts for update
to authenticated
using (
  (
    author_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and (p.approval_status = 'approved' or p.role = 'admin')
    )
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
)
with check (
  (
    author_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and (p.approval_status = 'approved' or p.role = 'admin')
    )
  )
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
  (
    author_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and (p.approval_status = 'approved' or p.role = 'admin')
    )
  )
  or exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

drop policy if exists notifications_select_owner on public.notifications;
create policy notifications_select_owner
on public.notifications for select
to authenticated
using (
  to_user_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.approval_status = 'approved' or p.role = 'admin')
  )
);

drop policy if exists notifications_insert_authenticated on public.notifications;
create policy notifications_insert_authenticated
on public.notifications for insert
to authenticated
with check (
  from_user_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.approval_status = 'approved' or p.role = 'admin')
  )
);

drop policy if exists notifications_update_owner on public.notifications;
create policy notifications_update_owner
on public.notifications for update
to authenticated
using (
  to_user_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.approval_status = 'approved' or p.role = 'admin')
  )
)
with check (
  to_user_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.approval_status = 'approved' or p.role = 'admin')
  )
);

drop policy if exists email_jobs_insert_authenticated on public.email_jobs;
create policy email_jobs_insert_authenticated
on public.email_jobs for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and (p.approval_status = 'approved' or p.role = 'admin')
  )
);

drop policy if exists email_jobs_select_admin on public.email_jobs;
create policy email_jobs_select_admin
on public.email_jobs for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);

create or replace function public.profiles_guard_approval_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.approval_status is distinct from old.approval_status then
    if not exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role = 'admin'
    ) then
      raise exception 'forbidden: only admin can change approval_status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_guard_approval_status_trg on public.profiles;
create trigger profiles_guard_approval_status_trg
before update on public.profiles
for each row
execute function public.profiles_guard_approval_status();
