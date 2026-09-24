-- Upgrade existing Student Hub click tracking to include taps on the card itself.
alter table public.student_practice_clicks
  drop constraint if exists student_practice_clicks_click_kind_check;
alter table public.student_practice_clicks
  add constraint student_practice_clicks_click_kind_check
  check (click_kind in ('link', 'quiz', 'card'));

create or replace function public.log_student_practice_click(
  p_student_id uuid, p_grade integer, p_full_name text,
  p_learner_code text, p_practice_id uuid, p_click_kind text
) returns void language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  if p_click_kind not in ('link','quiz','card') or p_practice_id is null then
    raise exception 'Invalid practice click';
  end if;
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
