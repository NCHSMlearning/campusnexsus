-- Super Admin-only Secure Exam Browser operational monitoring.
create or replace function public.get_cnseb_superadmin_monitor(p_institution_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private, auth
set row_security = off
as $$
declare
  v_active integer;
  v_stale integer;
  v_alerts integer;
  v_sessions jsonb;
begin
  if auth.uid() is null or not private.is_primary_superadmin() then
    raise exception 'Primary Super Admin access is required.' using errcode = '42501';
  end if;

  select count(*)::integer into v_active
  from public.live_exam_sessions s
  join public.exams e on e.id = s.exam_id
  where (p_institution_id is null or e.institution_id = p_institution_id)
    and s.last_heartbeat >= now() - interval '90 seconds';

  select count(*)::integer into v_stale
  from public.live_exam_sessions s
  join public.exams e on e.id = s.exam_id
  where (p_institution_id is null or e.institution_id = p_institution_id)
    and s.last_heartbeat < now() - interval '90 seconds';

  select count(*)::integer into v_alerts
  from public.exam_proctoring_logs l
  where (p_institution_id is null or l.institution_id = p_institution_id)
    and l.timestamp >= now() - interval '24 hours'
    and lower(coalesce(l.severity,'')) in ('warning','critical','high');

  select coalesce(jsonb_agg(jsonb_build_object(
    'student_id', q.student_id,
    'exam_id', q.exam_id,
    'exam_title', q.exam_title,
    'institution_id', q.institution_id,
    'claimed_at', q.claimed_at,
    'last_heartbeat', q.last_heartbeat,
    'user_agent', q.user_agent,
    'is_active', q.last_heartbeat >= now() - interval '90 seconds'
  ) order by q.last_heartbeat desc), '[]'::jsonb)
  into v_sessions
  from (
    select s.student_id, s.exam_id, e.title as exam_title, e.institution_id,
           s.claimed_at, s.last_heartbeat, s.user_agent
    from public.live_exam_sessions s
    join public.exams e on e.id = s.exam_id
    where p_institution_id is null or e.institution_id = p_institution_id
    order by s.last_heartbeat desc
    limit 50
  ) q;

  return jsonb_build_object(
    'active_sessions', v_active,
    'stale_sessions', v_stale,
    'proctoring_alerts_24h', v_alerts,
    'sessions', v_sessions,
    'generated_at', now()
  );
end;
$$;

revoke all on function public.get_cnseb_superadmin_monitor(uuid) from public, anon;
grant execute on function public.get_cnseb_superadmin_monitor(uuid) to authenticated;
