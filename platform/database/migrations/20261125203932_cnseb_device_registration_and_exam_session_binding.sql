-- CN-SEB v1.2.2: device approval and attempt-bound sessions
-- Applied to CAMPUS NEXUS production on 2026-11-25.

alter table public.device_registrations
  add column if not exists institution_id uuid references public.institutions(id) on delete cascade,
  add column if not exists approval_status text not null default 'pending',
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists app_version text,
  add column if not exists platform text,
  add column if not exists last_seen_at timestamptz,
  add column if not exists registration_source text not null default 'legacy';

alter table public.device_registrations drop constraint if exists device_registrations_approval_status_check;
alter table public.device_registrations add constraint device_registrations_approval_status_check
  check (approval_status in ('pending','approved','suspended','revoked','legacy_unverified'));
update public.device_registrations set approval_status='legacy_unverified'
 where approval_status='pending' and registration_source='legacy';

alter table public.live_exam_sessions
  add column if not exists device_registration_id uuid references public.device_registrations(id),
  add column if not exists client_version text;

create table if not exists public.cnseb_device_audit (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid references public.institutions(id) on delete cascade,
  device_registration_id uuid references public.device_registrations(id) on delete set null,
  actor_id uuid references auth.users(id),
  event_type text not null check (event_type in ('registered','approved','suspended','revoked','rejected','session_claimed','session_released','security_event')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists cnseb_device_audit_institution_created_idx on public.cnseb_device_audit(institution_id,created_at desc);
create index if not exists device_registrations_institution_status_idx on public.device_registrations(institution_id,approval_status,last_seen_at desc);
create index if not exists live_exam_sessions_device_idx on public.live_exam_sessions(device_registration_id,last_heartbeat desc);
alter table public.cnseb_device_audit enable row level security;
revoke all on public.cnseb_device_audit from anon,authenticated;
grant select on public.cnseb_device_audit to authenticated;

create or replace function public.cnseb_register_device(
 p_device_hash text,p_user_id uuid,p_exam_id integer,p_device_name text,p_device_details jsonb,p_app_version text,p_platform text
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_profile record; v_exam record; v_device public.device_registrations%rowtype; v_created boolean:=false;
begin
 if current_setting('request.jwt.claim.role',true)<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 if p_device_hash is null or length(p_device_hash)<>64 or p_user_id is null or p_exam_id is null then raise exception 'Invalid device registration request' using errcode='22023'; end if;
 select user_id,institution_id,full_name,role,status,login_enabled into v_profile from public.consolidated_user_profiles_table where user_id=p_user_id;
 if not found or lower(coalesce(v_profile.role,''))<>'student' or lower(coalesce(v_profile.status,'')) not in ('active','approved') or coalesce(v_profile.login_enabled,true) is not true then raise exception 'Active student account required' using errcode='42501'; end if;
 select id,institution_id,status,approval_status into v_exam from public.exams where id=p_exam_id;
 if not found or lower(coalesce(v_exam.status,''))<>'published' or lower(coalesce(v_exam.approval_status,''))<>'approved' or v_exam.institution_id is distinct from v_profile.institution_id then raise exception 'Exam is not authorised for this student or institution' using errcode='42501'; end if;
 select * into v_device from public.device_registrations where device_hash=p_device_hash for update;
 if found then
  if v_device.student_id<>p_user_id then raise exception 'This computer is already registered to another student' using errcode='23505'; end if;
  if v_device.approval_status in ('revoked','suspended') or not coalesce(v_device.is_active,false) then raise exception 'This computer registration has been suspended or revoked' using errcode='42501'; end if;
  update public.device_registrations set last_used=now(),last_seen_at=now(),total_checkins=coalesce(total_checkins,0)+1,
   device_name=left(coalesce(p_device_name,device_name),120),device_details=coalesce(p_device_details,'{}'::jsonb),
   app_version=left(coalesce(p_app_version,''),40),platform=left(coalesce(p_platform,''),40),
   institution_id=v_profile.institution_id,registration_source='cnseb' where id=v_device.id returning * into v_device;
 else
  insert into public.device_registrations(device_hash,student_id,student_name,device_name,device_details,institution_id,approval_status,is_active,total_checkins,app_version,platform,last_seen_at,registration_source)
  values(p_device_hash,p_user_id,v_profile.full_name,left(coalesce(p_device_name,'Windows device'),120),coalesce(p_device_details,'{}'::jsonb),v_profile.institution_id,'pending',true,1,left(coalesce(p_app_version,''),40),left(coalesce(p_platform,''),40),now(),'cnseb')
  returning * into v_device;
  v_created:=true;
 end if;
 insert into public.cnseb_device_audit(institution_id,device_registration_id,actor_id,event_type,details)
 values(v_profile.institution_id,v_device.id,p_user_id,case when v_created then 'registered' else 'security_event' end,jsonb_build_object('source','cnseb','app_version',p_app_version,'platform',p_platform));
 return jsonb_build_object('device_registration_id',v_device.id,'approval_status',v_device.approval_status,'institution_id',v_device.institution_id,'is_active',v_device.is_active);
end; $$;
revoke all on function public.cnseb_register_device(text,uuid,integer,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.cnseb_register_device(text,uuid,integer,text,jsonb,text,text) to service_role;

create or replace function public.cnseb_admin_list_devices(p_institution_id uuid default null)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private','auth' set row_security=off as $$
declare v_rows jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not private.is_primary_superadmin() and (p_institution_id is null or not private.has_active_institution_admin_access(p_institution_id)) then raise exception 'Institution administrator access required' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'student_id',d.student_id,'student_name',d.student_name,'device_name',d.device_name,'device_details',d.device_details,'approval_status',d.approval_status,'is_active',d.is_active,'app_version',d.app_version,'platform',d.platform,'first_registered',d.first_registered,'last_seen_at',d.last_seen_at,'total_checkins',d.total_checkins,'institution_id',d.institution_id) order by d.last_seen_at desc nulls last),'[]'::jsonb)
 into v_rows from public.device_registrations d where (private.is_primary_superadmin() and (p_institution_id is null or d.institution_id=p_institution_id)) or (not private.is_primary_superadmin() and d.institution_id=p_institution_id);
 return jsonb_build_object('devices',v_rows,'generated_at',now());
end; $$;
revoke all on function public.cnseb_admin_list_devices(uuid) from public,anon;
grant execute on function public.cnseb_admin_list_devices(uuid) to authenticated;

create or replace function public.cnseb_admin_set_device_status(p_device_id uuid,p_status text)
returns jsonb language plpgsql security definer set search_path='pg_catalog','public','private','auth' set row_security=off as $$
declare v_device public.device_registrations%rowtype; v_previous text; v_status text;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 v_status:=lower(coalesce(p_status,''));
 if v_status not in ('approved','suspended','revoked') then raise exception 'Invalid device status' using errcode='22023'; end if;
 select * into v_device from public.device_registrations where id=p_device_id for update;
 if not found then raise exception 'Device not found' using errcode='P0002'; end if;
 if not private.is_primary_superadmin() and not private.has_active_institution_admin_access(v_device.institution_id) then raise exception 'Not authorised to manage this device' using errcode='42501'; end if;
 v_previous:=v_device.approval_status;
 update public.device_registrations set approval_status=v_status,is_active=(v_status='approved'),
  approved_by=case when v_status='approved' then auth.uid() else approved_by end,
  approved_at=case when v_status='approved' then now() else approved_at end,
  revoked_at=case when v_status='revoked' then now() else null end
 where id=p_device_id returning * into v_device;
 insert into public.cnseb_device_audit(institution_id,device_registration_id,actor_id,event_type,details)
 values(v_device.institution_id,v_device.id,auth.uid(),v_status,jsonb_build_object('previous_status',v_previous));
 return jsonb_build_object('id',v_device.id,'approval_status',v_device.approval_status,'is_active',v_device.is_active);
end; $$;
revoke all on function public.cnseb_admin_set_device_status(uuid,text) from public,anon;
grant execute on function public.cnseb_admin_set_device_status(uuid,text) to authenticated;

create or replace function public.cnseb_claim_exam_session(p_exam_id integer,p_attempt_id uuid,p_session_token text,p_device_registration_id uuid,p_user_agent text default null)
returns table(ok boolean,reason text,last_heartbeat timestamptz)
language plpgsql security definer set search_path='pg_catalog','public','private','auth' set row_security=off as $$
declare v_profile record; v_exam record; v_attempt record; v_device record; v_existing public.live_exam_sessions%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select user_id,institution_id,role,status,login_enabled into v_profile from public.consolidated_user_profiles_table where user_id=auth.uid();
 if not found or lower(coalesce(v_profile.role,''))<>'student' or lower(coalesce(v_profile.status,'')) not in ('active','approved') or coalesce(v_profile.login_enabled,true) is not true then raise exception 'Active student account required' using errcode='42501'; end if;
 select id,institution_id,status,approval_status into v_exam from public.exams where id=p_exam_id;
 if not found or lower(coalesce(v_exam.status,''))<>'published' or lower(coalesce(v_exam.approval_status,''))<>'approved' or v_exam.institution_id is distinct from v_profile.institution_id then raise exception 'Exam is not authorised for this student' using errcode='42501'; end if;
 select id,student_id,exam_id,status into v_attempt from public.exam_attempts where id=p_attempt_id and student_id=auth.uid() and exam_id=p_exam_id for update;
 if not found or upper(coalesce(v_attempt.status,''))<>'IN_PROGRESS' then raise exception 'An active examination attempt is required' using errcode='42501'; end if;
 select id,student_id,institution_id,approval_status,is_active into v_device from public.device_registrations where id=p_device_registration_id;
 if not found or v_device.student_id<>auth.uid() or v_device.institution_id is distinct from v_profile.institution_id or v_device.approval_status<>'approved' or not coalesce(v_device.is_active,false) then raise exception 'This computer is not approved for secure examinations. Contact your institution administrator.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_exam_id::text,0));
 select * into v_existing from public.live_exam_sessions where student_id=auth.uid() and exam_id=p_exam_id for update;
 if found and v_existing.last_heartbeat>now()-interval '30 seconds' and v_existing.session_token<>p_session_token then return query select false,'Another tab or device already owns this exam session.',v_existing.last_heartbeat; return; end if;
 if found then
  update public.live_exam_sessions set session_token=p_session_token,attempt_id=p_attempt_id,device_registration_id=p_device_registration_id,
   device_fingerprint=(select device_hash from public.device_registrations where id=p_device_registration_id),user_agent=left(coalesce(p_user_agent,''),500),
   last_heartbeat=now(),claimed_at=case when session_token<>p_session_token then now() else claimed_at end where id=v_existing.id;
 else
  insert into public.live_exam_sessions(student_id,exam_id,attempt_id,session_token,device_registration_id,device_fingerprint,user_agent,ip_address)
  values(auth.uid(),p_exam_id,p_attempt_id,p_session_token,p_device_registration_id,(select device_hash from public.device_registrations where id=p_device_registration_id),left(coalesce(p_user_agent,''),500),'unknown');
 end if;
 update public.device_registrations set last_used=now(),last_seen_at=now(),total_checkins=coalesce(total_checkins,0)+1 where id=p_device_registration_id;
 insert into public.cnseb_device_audit(institution_id,device_registration_id,actor_id,event_type,details) values(v_profile.institution_id,p_device_registration_id,auth.uid(),'session_claimed',jsonb_build_object('exam_id',p_exam_id,'attempt_id',p_attempt_id));
 return query select true,'Secure exam session bound to approved device.',now();
end; $$;
revoke all on function public.cnseb_claim_exam_session(integer,uuid,text,uuid,text) from public,anon;
grant execute on function public.cnseb_claim_exam_session(integer,uuid,text,uuid,text) to authenticated;

create or replace function public.cnseb_heartbeat_exam_session(p_exam_id integer,p_session_token text,p_device_registration_id uuid)
returns boolean language plpgsql security definer set search_path='pg_catalog','public','private','auth' set row_security=off as $$
declare v_rows integer;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 update public.live_exam_sessions s set last_heartbeat=now() where s.student_id=auth.uid() and s.exam_id=p_exam_id and s.session_token=p_session_token and s.device_registration_id=p_device_registration_id
 and exists(select 1 from public.device_registrations d where d.id=s.device_registration_id and d.student_id=auth.uid() and d.approval_status='approved' and d.is_active=true);
 get diagnostics v_rows=row_count; return v_rows=1;
end; $$;
revoke all on function public.cnseb_heartbeat_exam_session(integer,text,uuid) from public,anon;
grant execute on function public.cnseb_heartbeat_exam_session(integer,text,uuid) to authenticated;
