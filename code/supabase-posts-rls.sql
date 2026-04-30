-- posts 테이블 작성자 소유권(RLS) 설정
-- 실행 전: Supabase SQL Editor에서 현재 스키마 확인

alter table if exists public.posts
  add column if not exists author_id uuid;

alter table if exists public.posts
  alter column created_at set default now();

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_author_id_idx on public.posts (author_id);

alter table public.posts enable row level security;

drop policy if exists "posts_select_all" on public.posts;
create policy "posts_select_all"
on public.posts
for select
to anon, authenticated
using (true);

drop policy if exists "posts_insert_own" on public.posts;
create policy "posts_insert_own"
on public.posts
for insert
to anon, authenticated
with check (auth.uid() = author_id);

drop policy if exists "posts_update_own" on public.posts;
create policy "posts_update_own"
on public.posts
for update
to anon, authenticated
using (auth.uid() = author_id)
with check (auth.uid() = author_id);

drop policy if exists "posts_delete_own" on public.posts;
create policy "posts_delete_own"
on public.posts
for delete
to anon, authenticated
using (auth.uid() = author_id);
