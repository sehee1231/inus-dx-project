-- 기존 글 author_id 백필 (Supabase SQL Editor에서 실행)
-- 목적: author_name 은 '세희'인데 author_id 가 다른 UUID(예: 예전 익명 계정)로 묶인 글을
--       모닥 로그인 계정(ksh@inuscomm.co.kr)의 profiles.id 로 연결
--
-- 사용 방법
-- 1) [1] 미리보기 SELECT 로 대상 글 확인
-- 2) [2] UPDATE 실행
-- 3) [3] 검증 SELECT 로 is_mine = true 확인
--
-- 참고: 코드에서도 관리자 로그인 시 profile.html 진입 시 자동 재할당(reclaim)을 시도합니다.

-- [1] 대상 미리보기
with params as (
  select
    '세희'::text as author_label,
    'ksh@inuscomm.co.kr'::text as email
),
me as (
  select p.id
  from public.profiles p
  join auth.users u on u.id = p.id
  join params x on true
  where lower(u.email) = lower(x.email)
  limit 1
)
select
  po.slug,
  po.author_name,
  po.author_id as current_author_id,
  me.id as target_author_id,
  po.created_at
from public.posts po
join params x on true
cross join me
where po.author_name = x.author_label
  and po.author_id is distinct from me.id
order by po.created_at desc;

-- [2] 실제 반영 (트랜잭션)
begin;

with params as (
  select
    '세희'::text as author_label,
    'ksh@inuscomm.co.kr'::text as email
),
me as (
  select p.id
  from public.profiles p
  join auth.users u on u.id = p.id
  join params x on true
  where lower(u.email) = lower(x.email)
  limit 1
)
update public.posts po
set author_id = me.id
from me, params x
where po.author_name = x.author_label
  and po.author_id is distinct from me.id;

commit;

-- [3] 검증
with params as (
  select
    '세희'::text as author_label,
    'ksh@inuscomm.co.kr'::text as email
),
me as (
  select p.id
  from public.profiles p
  join auth.users u on u.id = p.id
  join params x on true
  where lower(u.email) = lower(x.email)
  limit 1
)
select
  po.slug,
  po.author_name,
  po.author_id,
  (po.author_id = me.id) as is_mine
from public.posts po
join params x on true
cross join me
where po.author_name = x.author_label
order by po.created_at desc;
