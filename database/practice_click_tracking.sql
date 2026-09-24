-- Run against the Supabase project used by SSH (gbezoogwevzctjxemuif).
-- The public app uses the existing learner-code login RPC. No browser receives a service key.
begin;

create table if not exists public.student_practice_clicks (
  id bigint generated always as identity primary key,
  student_id uuid not null,
  practice_id uuid not null,
  click_kind text not null check (click_kind in ('link', 'quiz')),
  clicked_at timestamptz not null default now()
);
create index if not exists student_practice_clicks_item_time
  on public.student_practice_clicks (practice_id, student_id, clicked_at);
alter table public.student_practice_clicks enable row level security;
revoke all on public.student_practice_clicks from public, anon, authenticated;
grant select on public.student_practice_clicks to service_role;

create or replace function public.log_student_practice_click(
  p_student_id uuid, p_grade integer, p_full_name text,
  p_learner_code text, p_practice_id uuid, p_click_kind text
) returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if p_click_kind not in ('link','quiz') or p_practice_id is null then
    raise exception 'Invalid practice click';
  end if;
  -- Verify the learner code against the same login used by the Student Hub.
  if not exists (
    select 1 from public.login_student(p_grade, p_full_name, p_learner_code) s
    where s.student_id = p_student_id
  ) then
    raise exception 'Invalid learner access';
  end if;
  insert into public.student_practice_clicks (student_id,practice_id,click_kind)
  select p_student_id,p_practice_id,p_click_kind
  from public.student_practice_work p
  where p.id=p_practice_id and p.student_id=p_student_id
    and (p.grade_level is null or p.grade_level=p_grade) and p.active=true
  limit 1;
  if not found then raise exception 'Practice item unavailable'; end if;
end $$;
revoke all on function public.log_student_practice_click(uuid,integer,text,text,uuid,text)
  from public, anon, authenticated;
grant execute on function public.log_student_practice_click(uuid,integer,text,text,uuid,text)
  to anon, authenticated;
commit;

-- Smoke check after deployment (no learner code needed):
-- select count(*) from public.student_practice_clicks;
-- Confirm the Student Hub sends a click, then inspect practice_id, click_kind, clicked_at.
