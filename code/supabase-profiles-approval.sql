-- 회원 승인제: 기존 DB에 한 번 실행 (Supabase SQL Editor)
-- 신규 프로젝트는 supabase-app-schema.sql 을 기준으로 맞추면 됩니다.

alter table public.profiles
  add column if not exists approval_status text not null default 'pending';

alter table public.profiles drop constraint if exists profiles_approval_status_check;
alter table public.profiles
  add constraint profiles_approval_status_check
  check (approval_status in ('pending', 'approved', 'rejected'));

-- 관리자 계정은 항상 승인 (도입 직후 관리자 화면 접근 보장)
update public.profiles set approval_status = 'approved' where role = 'admin';

-- 나머지 기존 회원도 모두 승인하려면 아래 주석을 해제해 한 번만 실행 (재실행 시 거절된 계정도 풀림)
-- update public.profiles set approval_status = 'approved' where approval_status = 'pending';

-- 본인이 가입 시 스스로 approved 로 못 올리게: insert 는 pending 만
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self
on public.profiles for insert
to authenticated
with check (
  id = auth.uid()
  and coalesce(approval_status, 'pending') = 'pending'
);

-- 본인이 approval_status 를 바꾸지 못하게 (관리자만 변경)
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

-- 승인된 회원(또는 관리자)만 공개 글 열람·작성
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
