-- CN-SEB durable, attempt-scoped answer recovery.
-- Browser storage remains a fast local fallback; this table is the server-side draft copy.
create table if not exists public.exam_attempt_answer_drafts (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  exam_id integer not null references public.exams(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  question_id uuid not null references public.exam_questions(id) on delete cascade,
  institution_id uuid,
  answer text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (attempt_id, question_id)
);

create index if not exists idx_exam_attempt_answer_drafts_student_exam
  on public.exam_attempt_answer_drafts (student_id, exam_id, attempt_id);

alter table public.exam_attempt_answer_drafts enable row level security;
revoke all on public.exam_attempt_answer_drafts from anon, authenticated;

create or replace function public.save_exam_attempt_answer_draft(
  p_attempt_id uuid,
  p_exam_id integer,
  p_question_id uuid,
  p_answer text,
  p_session_token text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_exam public.exams%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_attempt_id is null or p_exam_id is null or p_question_id is null
     or p_session_token is null or length(p_session_token) < 16 then
    raise exception 'Invalid answer draft request' using errcode = '22023';
  end if;

  select * into v_attempt
  from public.exam_attempts
  where id = p_attempt_id
    and exam_id = p_exam_id
    and student_id = auth.uid()
  for update;

  if not found or upper(coalesce(v_attempt.status,'')) <> 'IN_PROGRESS'
     or v_attempt.submitted_at is not null then
    raise exception 'This examination attempt is not active' using errcode = '42501';
  end if;

  select * into v_exam from public.exams where id = p_exam_id;
  if not found then raise exception 'Examination not found'; end if;

  if not exists (
    select 1 from public.exam_questions
    where id = p_question_id and exam_id = p_exam_id
  ) then
    raise exception 'Question does not belong to this examination' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.live_exam_sessions
    where student_id = auth.uid()
      and exam_id = p_exam_id
      and session_token = p_session_token
      and last_heartbeat > now() - interval '90 seconds'
  ) then
    raise exception 'The active examination session could not be verified. Reconnect and retry.' using errcode = '42501';
  end if;

  insert into public.exam_attempt_answer_drafts
    (attempt_id, exam_id, student_id, question_id, institution_id, answer, updated_at)
  values
    (p_attempt_id, p_exam_id, auth.uid(), p_question_id, v_exam.institution_id,
     left(coalesce(p_answer,''), 50000), v_now)
  on conflict (attempt_id, question_id) do update
    set answer = excluded.answer,
        updated_at = excluded.updated_at
    where public.exam_attempt_answer_drafts.student_id = auth.uid();

  return jsonb_build_object('saved', true, 'question_id', p_question_id, 'updated_at', v_now);
end;
$$;

create or replace function public.get_exam_attempt_answer_drafts(
  p_attempt_id uuid,
  p_exam_id integer,
  p_session_token text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
set row_security = off
as $$
declare
  v_attempt public.exam_attempts%rowtype;
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_attempt
  from public.exam_attempts
  where id = p_attempt_id and exam_id = p_exam_id and student_id = auth.uid();

  if not found or upper(coalesce(v_attempt.status,'')) <> 'IN_PROGRESS'
     or v_attempt.submitted_at is not null then
    raise exception 'This examination attempt is not active' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.live_exam_sessions
    where student_id = auth.uid()
      and exam_id = p_exam_id
      and session_token = p_session_token
      and last_heartbeat > now() - interval '90 seconds'
  ) then
    raise exception 'The active examination session could not be verified' using errcode = '42501';
  end if;

  select coalesce(jsonb_object_agg(question_id::text,
    jsonb_build_object('answer', answer, 'updated_at', updated_at)), '{}'::jsonb)
  into v_result
  from public.exam_attempt_answer_drafts
  where attempt_id = p_attempt_id and exam_id = p_exam_id and student_id = auth.uid();

  return v_result;
end;
$$;

revoke all on function public.save_exam_attempt_answer_draft(uuid, integer, uuid, text, text) from public, anon;
revoke all on function public.get_exam_attempt_answer_drafts(uuid, integer, text) from public, anon;
grant execute on function public.save_exam_attempt_answer_draft(uuid, integer, uuid, text, text) to authenticated;
grant execute on function public.get_exam_attempt_answer_drafts(uuid, integer, text) to authenticated;
