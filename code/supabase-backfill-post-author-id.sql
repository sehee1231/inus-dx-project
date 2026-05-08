-- 기존 글 author_id 백필 (Supabase SQL Editor에서 수동 실행)
-- 목적: author_name 은 내 이름인데 author_id 가 null 인 글을 내 계정 UUID로 연결
--
-- 사용 방법
-- 1) 아래 params CTE 의 display_name / email 값을 본인 계정으로 수정
-- 2) [1] 미리보기 SELECT 결과 확인
-- 3) [2] UPDATE 실행
-- 4) [3] 검증 SELECT로 author_id 반영 확인

-- [1] 대상 미리보기
with params as (
  select
    '세희'::text as display_name,
    'YOUR_EMAIL@example.com'::text as email
),
me as (
  select p.id
  from public.profiles p
  join auth.users u on u.id = p.id
  join params x on true
  where p.display_name = x.display_name
    and u.email = x.email
  limit 1
)
select
  po.id,
  po.slug,
  po.author_name,
  po.author_id,
  po.created_at
from public.posts po
join params x on true
where po.author_id is null
  and po.author_name = x.display_name
order by po.created_at desc;

-- [2] 실제 반영 (트랜잭션)
begin;

with params as (
  select
    '세희'::text as display_name,
    'YOUR_EMAIL@example.com'::text as email
),
me as (
  select p.id
  from public.profiles p
  join auth.users u on u.id = p.id
  join params x on true
  where p.display_name = x.display_name
    and u.email = x.email
  limit 1
)
update public.posts po
set author_id = me.id
from me, params x
where po.author_id is null
  and po.author_name = x.display_name;

commit;

-- [3] 검증
with params as (
  select
    '세희'::text as display_name,
    'YOUR_EMAIL@example.com'::text as email
),
me as (
  select p.id
  from public.profiles p
  join auth.users u on u.id = p.id
  join params x on true
  where p.display_name = x.display_name
    and u.email = x.email
  limit 1
)
select
  po.slug,
  po.author_name,
  po.author_id,
  (po.author_id = me.id) as is_mine
from public.posts po
join params x on true
join me on true
where po.author_name = x.display_name
order by po.created_at desc;
