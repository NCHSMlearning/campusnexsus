-- CN-SEB v1.2.4: strict device-bound session, autosave and submission enforcement
-- Existing browser exam flow remains backward-compatible; desktop CN-SEB uses these RPCs.

create or replace function public.cnseb_claim_exam_session(
  p_exam_id integer,
  p_attempt_id uuid,
  p_session_token text,
  p_device_registration_id uuid,
  p_user_agent text default null
)
returns table(ok boolean, reason text, last_heartbeat timestamptz)
language plpgsql
security definer
set search_path='pg_catalog','public','private','auth'
set row_security=off
as $$
declare
  v_profile record;
  v_exam record;
  v_attempt record;
  v_device record;
  v_existing public.live_exam_sessions%rowtype;
begin
  if auth.uid() is null or p_session_token is null or length(p_session_token)<32
     or p_device_registration_id is null or p_attempt_id is null then
    raise exception 'A valid authenticated secure exam session is required' using errcode='42501';
  end if;

  select user_id,institution_id,role,status,login_enabled into v_profile
  from public.consolidated_user_profiles_table where user_id=auth.uid();
  if not found or lower(coalesce(v_profile.role,''))<>'student'
     or lower(coalesce(v_profile.status,'')) not in ('active','approved')
     or coalesce(v_profile.login_enabled,true) is not true then
    raise exception 'Active student account required' using errcode='42501';
  end if;

  select id,institution_id,status,approval_status into v_exam
  from public.exams where id=p_exam_id;
  if not found or lower(coalesce(v_exam.status,''))<>'published'
     or lower(coalesce(v_exam.approval_status,''))<>'approved'
     or v_exam.institution_id is distinct from v_profile.institution_id then
    raise exception 'Exam is not authorised for this student' using errcode='42501';
  end if;

  select id,student_id,exam_id,status into v_attempt
  from public.exam_attempts
  where id=p_attempt_id and student_id=auth.uid() and exam_id=p_exam_id
  for update;
  if not found or upper(coalesce(v_attempt.status,''))<>'IN_PROGRESS' then
    raise exception 'An active examination attempt is required' using errcode='42501';
  end if;

  select id,student_id,institution_id,approval_status,is_active,device_hash into v_device
  from public.device_registrations where id=p_device_registration_id for share;
  if not found or v_device.student_id<>auth.uid()
     or v_device.institution_id is distinct from v_profile.institution_id
     or v_device.approval_status<>'approved' or not coalesce(v_device.is_active,false) then
    raise exception 'This computer is not approved for secure examinations. Contact your institution administrator.' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_exam_id::text,0));
  select * into v_existing from public.live_exam_sessions
  where student_id=auth.uid() and exam_id=p_exam_id for update;

  if found then
    -- A session can only resume on the same approved device and same attempt.
    -- A different computer must be explicitly released by an administrator.
    if v_existing.device_registration_id is distinct from p_device_registration_id
       or v_existing.attempt_id is distinct from p_attempt_id then
      return query select false,'This examination is already bound to another device or attempt. Contact the examination administrator to release the previous session.',v_existing.last_heartbeat;
      return;
    end if;
    if v_existing.last_heartbeat>now()-interval '90 seconds'
       and v_existing.session_token<>p_session_token then
      return query select false,'Another tab already owns this examination session.',v_existing.last_heartbeat;
      return;
    end if;
    update public.live_exam_sessions
      set session_token=p_session_token,user_agent=left(coalesce(p_user_agent,''),500),
          device_fingerprint=v_device.device_hash,last_heartbeat=now(),
          claimed_at=case when session_token<>p_session_token then now() else claimed_at end
    where id=v_existing.id;
  else
    insert into public.live_exam_sessions(student_id,exam_id,attempt_id,session_token,
      device_registration_id,device_fingerprint,user_agent,ip_address)
    values(auth.uid(),p_exam_id,p_attempt_id,p_session_token,p_device_registration_id,
      v_device.device_hash,left(coalesce(p_user_agent,''),500),'unknown');
  end if;

  update public.device_registrations
    set last_used=now(),last_seen_at=now(),total_checkins=coalesce(total_checkins,0)+1
  where id=p_device_registration_id;

  insert into public.cnseb_device_audit(institution_id,device_registration_id,actor_id,event_type,details)
  values(v_profile.institution_id,p_device_registration_id,auth.uid(),'session_claimed',
    jsonb_build_object('exam_id',p_exam_id,'attempt_id',p_attempt_id));
  return query select true,'Secure exam session bound to approved device.',now();
end;
$$;
revoke all on function public.cnseb_claim_exam_session(integer,uuid,text,uuid,text) from public,anon;
grant execute on function public.cnseb_claim_exam_session(integer,uuid,text,uuid,text) to authenticated;

create or replace function public.cnseb_heartbeat_exam_session(
  p_exam_id integer,p_session_token text,p_device_registration_id uuid
)
returns boolean
language plpgsql
security definer
set search_path='pg_catalog','public','private','auth'
set row_security=off
as $$
declare v_rows integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  update public.live_exam_sessions s set last_heartbeat=now()
  where s.student_id=auth.uid() and s.exam_id=p_exam_id
    and s.session_token=p_session_token and s.device_registration_id=p_device_registration_id
    and s.last_heartbeat>now()-interval '5 minutes'
    and exists(
      select 1 from public.device_registrations d
      where d.id=s.device_registration_id and d.student_id=auth.uid()
        and d.approval_status='approved' and d.is_active=true
    )
    and exists(
      select 1 from public.exam_attempts a
      where a.id=s.attempt_id and a.student_id=auth.uid()
        and a.exam_id=p_exam_id and upper(coalesce(a.status,''))='IN_PROGRESS'
        and a.submitted_at is null
    )
    and exists(
      select 1 from public.exams e
      where e.id=p_exam_id and lower(coalesce(e.status,''))='published'
        and lower(coalesce(e.approval_status,''))='approved'
    )
    and exists(
      select 1 from public.consolidated_user_profiles_table p
      where p.user_id=auth.uid() and lower(coalesce(p.role,''))='student'
        and lower(coalesce(p.status,'')) in ('active','approved')
        and coalesce(p.login_enabled,true)=true
    );
  get diagnostics v_rows=row_count;
  return v_rows=1;
end;
$$;
revoke all on function public.cnseb_heartbeat_exam_session(integer,text,uuid) from public,anon;
grant execute on function public.cnseb_heartbeat_exam_session(integer,text,uuid) to authenticated;

create or replace function public.cnseb_save_exam_attempt_answer_draft(
  p_attempt_id uuid,p_exam_id integer,p_question_id uuid,p_answer text,
  p_session_token text,p_device_registration_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','auth'
set row_security=off
as $$
declare v_session public.live_exam_sessions%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select * into v_session from public.live_exam_sessions
  where student_id=auth.uid() and exam_id=p_exam_id
    and attempt_id=p_attempt_id and session_token=p_session_token
    and device_registration_id=p_device_registration_id
    and last_heartbeat>now()-interval '90 seconds'
  for update;
  if not found then raise exception 'Secure device-bound examination session expired or was replaced. Reconnect before saving.' using errcode='42501'; end if;
  if not exists(select 1 from public.device_registrations d
    where d.id=p_device_registration_id and d.student_id=auth.uid()
      and d.approval_status='approved' and d.is_active=true) then
    raise exception 'This computer is no longer approved for the examination.' using errcode='42501';
  end if;
  return public.save_exam_attempt_answer_draft(
    p_attempt_id,p_exam_id,p_question_id,p_answer,p_session_token
  );
end;
$$;
revoke all on function public.cnseb_save_exam_attempt_answer_draft(uuid,integer,uuid,text,text,uuid) from public,anon;
grant execute on function public.cnseb_save_exam_attempt_answer_draft(uuid,integer,uuid,text,text,uuid) to authenticated;

create or replace function public.cnseb_submit_exam_attempt_secure(
  p_student_id uuid,p_exam_id integer,p_attempt_id uuid,p_answers jsonb,
  p_attempt_number integer,p_is_retake boolean,p_retake_count integer,
  p_session_token text,p_device_registration_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','auth'
set row_security=off
as $$
declare v_session public.live_exam_sessions%rowtype;
begin
  if auth.uid() is null or p_student_id is distinct from auth.uid() then
    raise exception 'Student identity could not be verified' using errcode='42501';
  end if;
  select * into v_session from public.live_exam_sessions
  where student_id=auth.uid() and exam_id=p_exam_id
    and attempt_id=p_attempt_id and session_token=p_session_token
    and device_registration_id=p_device_registration_id
    and last_heartbeat>now()-interval '90 seconds'
  for update;
  if not found then raise exception 'Secure device-bound session is not active. Submission was not accepted.' using errcode='42501'; end if;
  if not exists(select 1 from public.device_registrations d
    where d.id=p_device_registration_id and d.student_id=auth.uid()
      and d.approval_status='approved' and d.is_active=true) then
    raise exception 'This computer is no longer approved. Submission was not accepted.' using errcode='42501';
  end if;
  return public.submit_exam_attempt_secure(
    p_student_id,p_exam_id,p_attempt_id,p_answers,p_attempt_number,p_is_retake,p_retake_count
  );
end;
$$;
revoke all on function public.cnseb_submit_exam_attempt_secure(uuid,integer,uuid,jsonb,integer,boolean,integer,text,uuid) from public,anon;
grant execute on function public.cnseb_submit_exam_attempt_secure(uuid,integer,uuid,jsonb,integer,boolean,integer,text,uuid) to authenticated;

create or replace function public.cnseb_admin_set_device_status(p_device_id uuid,p_status text)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private','auth'
set row_security=off
as $$
declare v_device public.device_registrations%rowtype; v_previous text; v_status text;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  v_status:=lower(coalesce(p_status,''));
  if v_status not in ('approved','suspended','revoked') then raise exception 'Invalid device status' using errcode='22023'; end if;
  select * into v_device from public.device_registrations where id=p_device_id for update;
  if not found then raise exception 'Device not found' using errcode='P0002'; end if;
  if not private.is_primary_superadmin()
     and not private.has_active_institution_admin_access(v_device.institution_id) then
    raise exception 'Not authorised to manage this device' using errcode='42501';
  end if;
  v_previous:=v_device.approval_status;
  update public.device_registrations
    set approval_status=v_status,is_active=(v_status='approved'),
        approved_by=case when v_status='approved' then auth.uid() else approved_by end,
        approved_at=case when v_status='approved' then now() else approved_at end,
        revoked_at=case when v_status='revoked' then now() else null end
  where id=p_device_id returning * into v_device;
  insert into public.cnseb_device_audit(institution_id,device_registration_id,actor_id,event_type,details)
  values(v_device.institution_id,v_device.id,auth.uid(),v_status,
    jsonb_build_object('previous_status',v_previous));
  return jsonb_build_object('id',v_device.id,'approval_status',v_device.approval_status,'is_active',v_device.is_active);
end;
$$;
revoke all on function public.cnseb_admin_set_device_status(uuid,text) from public,anon;
grant execute on function public.cnseb_admin_set_device_status(uuid,text) to authenticated;

create or replace function public.cnseb_admin_release_exam_session(p_student_id uuid,p_exam_id integer)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private','auth'
set row_security=off
as $$
declare v_institution uuid; v_device uuid; v_attempt uuid; v_deleted integer;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
  select e.institution_id into v_institution from public.exams e where e.id=p_exam_id;
  if not found then raise exception 'Examination not found' using errcode='P0002'; end if;
  if not private.is_primary_superadmin()
     and not private.has_active_institution_admin_access(v_institution) then
    raise exception 'Not authorised to release this examination session' using errcode='42501';
  end if;
  select device_registration_id,attempt_id into v_device,v_attempt
  from public.live_exam_sessions where student_id=p_student_id and exam_id=p_exam_id for update;
  if not found then return jsonb_build_object('released',false,'message','No live session exists'); end if;
  delete from public.live_exam_sessions where student_id=p_student_id and exam_id=p_exam_id;
  get diagnostics v_deleted=row_count;
  insert into public.cnseb_device_audit(institution_id,device_registration_id,actor_id,event_type,details)
  values(v_institution,v_device,auth.uid(),'session_released',
    jsonb_build_object('student_id',p_student_id,'exam_id',p_exam_id,'attempt_id',v_attempt));
  return jsonb_build_object('released',v_deleted=1);
end;
$$;
revoke all on function public.cnseb_admin_release_exam_session(uuid,integer) from public,anon;
grant execute on function public.cnseb_admin_release_exam_session(uuid,integer) to authenticated;
