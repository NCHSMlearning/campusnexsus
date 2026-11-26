-- Immutable examination configuration snapshot captured when an attempt is created.
-- Student-facing question fields only: answer keys and marking rubrics are deliberately excluded.
create table if not exists public.exam_attempt_configuration_snapshots (
  attempt_id uuid primary key references public.exam_attempts(id) on delete cascade,
  exam_id integer not null references public.exams(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  institution_id uuid,
  snapshot_payload jsonb not null,
  snapshot_sha256 text not null,
  question_count integer not null default 0 check (question_count >= 0),
  captured_at timestamptz not null default now()
);

create index if not exists idx_exam_attempt_config_snapshots_institution
  on public.exam_attempt_configuration_snapshots (institution_id, captured_at desc);

alter table public.exam_attempt_configuration_snapshots enable row level security;
revoke all on public.exam_attempt_configuration_snapshots from public, anon, authenticated;

create or replace function public.cnseb_capture_exam_configuration_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions, auth
set row_security = off
as $$
declare
  v_exam public.exams%rowtype;
  v_questions jsonb;
  v_payload jsonb;
  v_count integer;
begin
  select * into v_exam from public.exams where id = new.exam_id;
  if not found then raise exception 'Cannot snapshot an examination that does not exist'; end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', q.id, 'question_number', q.question_number,
      'question_text', q.question_text, 'question_type', q.question_type,
      'option_a', q.option_a, 'option_b', q.option_b, 'option_c', q.option_c,
      'option_d', q.option_d, 'option_e', q.option_e, 'marks', q.marks,
      'max_chars', q.max_chars, 'image_url', q.image_url
    ) order by q.question_number, q.id
  ), '[]'::jsonb), count(*)::integer
  into v_questions, v_count
  from public.exam_questions q where q.exam_id = new.exam_id;

  v_payload := jsonb_build_object(
    'schema_version', 1,
    'exam', jsonb_build_object(
      'id', v_exam.id, 'title', coalesce(v_exam.title, v_exam.exam_name),
      'description', v_exam.description, 'instructions', v_exam.instructions,
      'exam_type', v_exam.exam_type, 'duration_minutes', v_exam.duration_minutes,
      'start_time', v_exam.start_time, 'end_time', v_exam.end_time,
      'exam_date', v_exam.exam_date, 'total_marks', v_exam.total_marks,
      'marks_out_of', v_exam.marks_out_of, 'pass_mark', v_exam.pass_mark,
      'course_id', v_exam.course_id, 'course_code', v_exam.course_code,
      'course_name', v_exam.course_name, 'institution_id', v_exam.institution_id
    ),
    'questions', v_questions
  );

  insert into public.exam_attempt_configuration_snapshots (
    attempt_id, exam_id, student_id, institution_id,
    snapshot_payload, snapshot_sha256, question_count
  ) values (
    new.id, new.exam_id, new.student_id, v_exam.institution_id,
    v_payload, encode(extensions.digest(v_payload::text, 'sha256'), 'hex'), v_count
  ) on conflict (attempt_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_cnseb_capture_exam_configuration_snapshot on public.exam_attempts;
create trigger trg_cnseb_capture_exam_configuration_snapshot
after insert on public.exam_attempts
for each row execute function public.cnseb_capture_exam_configuration_snapshot();

create or replace function public.cnseb_prevent_exam_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
set row_security = off
as $$
begin
  raise exception 'Examination attempt configuration snapshots are immutable';
end;
$$;

drop trigger if exists trg_cnseb_immutable_exam_snapshot on public.exam_attempt_configuration_snapshots;
create trigger trg_cnseb_immutable_exam_snapshot
before update or delete on public.exam_attempt_configuration_snapshots
for each row execute function public.cnseb_prevent_exam_snapshot_mutation();

revoke all on function public.cnseb_capture_exam_configuration_snapshot() from public, anon, authenticated;
revoke all on function public.cnseb_prevent_exam_snapshot_mutation() from public, anon, authenticated;
