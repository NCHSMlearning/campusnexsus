-- CN-SEB v1.2.4 follow-up: reapproval on institution change and live authorization checks
create or replace function public.cnseb_register_device(
 p_device_hash text,p_user_id uuid,p_exam_id integer,p_device_name text,
 p_device_details jsonb,p_app_version text,p_platform text
) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_profile record; v_exam record; v_device public.device_registrations%rowtype; v_created boolean:=false; v_reapproval boolean:=false;
begin
 if current_setting('request.jwt.claim.role',true)<>'service_role' then raise exception 'forbidden' using errcode='42501'; end if;
 if p_device_hash is null or length(p_device_hash)<>64 or p_user_id is null or p_exam_id is null then
   raise exception 'Invalid device registration request' using errcode='22023';
 end if;
 select user_id,institution_id,full_name,role,status,login_enabled into v_profile
 from public.consolidated_user_profiles_table where user_id=p_user_id;
 if not found or lower(coalesce(v_profile.role,''))<>'student'
    or lower(coalesce(v_profile.status,'')) not in ('active','approved')
    or coalesce(v_profile.login_enabled,true) is not true then
   raise exception 'Active student account required' using errcode='42501';
 end if;
 select id,institution_id,status,approval_status into v_exam from public.exams where id=p_exam_id;
 if not found or lower(coalesce(v_exam.status,''))<>'published'
    or lower(coalesce(v_exam.approval_status,''))<>'approved'
    or v_exam.institution_id is distinct from v_profile.institution_id then
   raise exception 'Exam is not authorised for this student or institution' using errcode='42501';
 end if;
 select * into v_device from public.device_registrations where device_hash=p_device_hash for update;
 if found then
   if v_device.student_id<>p_user_id then raise exception 'This computer is already registered to another student' using errcode='23505'; end if;
   if v_device.approval_status in ('revoked','suspended') or not coalesce(v_device.is_active,false) then
     raise exception 'This computer registration has been suspended or revoked' using errcode='42501';
   end if;
   v_reapproval:=v_device.institution_id is distinct from v_profile.institution_id;
   update public.device_registrations
     set last_used=now(),last_seen_at=now(),total_checkins=coalesce(total_checkins,0)+1,
         device_name=left(coalesce(p_device_name,device_name),120),
         device_details=coalesce(p_device_details,'{}'::jsonb),
         app_version=left(coalesce(p_app_version,''),40),platform=left(coalesce(p_platform,''),40),
         institution_id=v_profile.institution_id,
         approval_status=case when v_reapproval then 'pending' else approval_status end,
         is_active=case when v_reapproval then false else is_active end,
         approved_by=case when v_reapproval then null else approved_by end,
         approved_at=case when v_reapproval then null else approved_at end,
         registration_source='cnseb'
   where id=v_device.id returning * into v_device;
 else
   insert into public.device_registrations(device_hash,student_id,student_name,device_name,device_details,
     institution_id,approval_status,is_active,total_checkins,app_version,platform,last_seen_at,registration_source)
   values(p_device_hash,p_user_id,v_profile.full_name,left(coalesce(p_device_name,'Windows device'),120),
     coalesce(p_device_details,'{}'::jsonb),v_profile.institution_id,'pending',true,1,
     left(coalesce(p_app_version,''),40),left(coalesce(p_platform,''),40),now(),'cnseb')
   returning * into v_device;
   v_created:=true;
 end if;
 insert into public.cnseb_device_audit(institution_id,device_registration_id,actor_id,event_type,details)
 values(v_profile.institution_id,v_device.id,p_user_id,
   case when v_created then 'registered' when v_reapproval then 'security_event' else 'security_event' end,
   jsonb_build_object('source','cnseb','app_version',p_app_version,'platform',p_platform,'requires_reapproval',v_reapproval));
 return jsonb_build_object('device_registration_id',v_device.id,'approval_status',v_device.approval_status,
   'institution_id',v_device.institution_id,'is_active',v_device.is_active);
end;
$$;
revoke all on function public.cnseb_register_device(text,uuid,integer,text,jsonb,text,text) from public,anon,authenticated;
grant execute on function public.cnseb_register_device(text,uuid,integer,text,jsonb,text,text) to service_role;

create or replace function public.cnseb_save_exam_attempt_answer_draft(
 p_attempt_id uuid,p_exam_id integer,p_question_id uuid,p_answer text,
 p_session_token text,p_device_registration_id uuid
) returns jsonb
language plpgsql security definer set search_path='pg_catalog','public','auth' set row_security=off as $$
declare v_session public.live_exam_sessions%rowtype;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select * into v_session from public.live_exam_sessions
 where student_id=auth.uid() and exam_id=p_exam_id and attempt_id=p_attempt_id
   and session_token=p_session_token and device_registration_id=p_device_registration_id
   and last_heartbeat>now()-interval '90 seconds' for update;
 if not found then raise exception 'Secure device-bound examination session expired or was replaced. Reconnect before saving.' using errcode='42501'; end if;
 if not exists(select 1 from public.device_registrations d where d.id=p_device_registration_id
   and d.student_id=auth.uid() and d.approval_status='approved' and d.is_active=true)
   or not exists(select 1 from public.exams e where e.id=p_exam_id
     and lower(coalesce(e.status,''))='published' and lower(coalesce(e.approval_status,''))='approved')
   or not exists(select 1 from public.consolidated_user_profiles_table p where p.user_id=auth.uid()
     and lower(coalesce(p.role,''))='student' and lower(coalesce(p.status,'')) in ('active','approved')
     and coalesce(p.login_enabled,true)=true) then
   raise exception 'Device, examination or student authorization is no longer valid.' using errcode='42501';
 end if;
 return public.save_exam_attempt_answer_draft(p_attempt_id,p_exam_id,p_question_id,p_answer,p_session_token);
end;
$$;
revoke all on function public.cnseb_save_exam_attempt_answer_draft(uuid,integer,uuid,text,text,uuid) from public,anon;
grant execute on function public.cnseb_save_exam_attempt_answer_draft(uuid,integer,uuid,text,text,uuid) to authenticated;

create or replace function public.cnseb_submit_exam_attempt_secure(
 p_student_id uuid,p_exam_id integer,p_attempt_id uuid,p_answers jsonb,
 p_attempt_number integer,p_is_retake boolean,p_retake_count integer,
 p_session_token text,p_device_registration_id uuid
) returns jsonb
language plpgsql security definer set search_path='pg_catalog','public','auth' set row_security=off as $$
declare v_session public.live_exam_sessions%rowtype;
begin
 if auth.uid() is null or p_student_id is distinct from auth.uid() then
   raise exception 'Student identity could not be verified' using errcode='42501';
 end if;
 select * into v_session from public.live_exam_sessions
 where student_id=auth.uid() and exam_id=p_exam_id and attempt_id=p_attempt_id
   and session_token=p_session_token and device_registration_id=p_device_registration_id
   and last_heartbeat>now()-interval '90 seconds' for update;
 if not found then raise exception 'Secure device-bound session is not active. Submission was not accepted.' using errcode='42501'; end if;
 if not exists(select 1 from public.device_registrations d where d.id=p_device_registration_id
   and d.student_id=auth.uid() and d.approval_status='approved' and d.is_active=true)
   or not exists(select 1 from public.exams e where e.id=p_exam_id
     and lower(coalesce(e.status,''))='published' and lower(coalesce(e.approval_status,''))='approved')
   or not exists(select 1 from public.consolidated_user_profiles_table p where p.user_id=auth.uid()
     and lower(coalesce(p.role,''))='student' and lower(coalesce(p.status,'')) in ('active','approved')
     and coalesce(p.login_enabled,true)=true) then
   raise exception 'Device, examination or student authorization is no longer valid. Submission was not accepted.' using errcode='42501';
 end if;
 return public.submit_exam_attempt_secure(p_student_id,p_exam_id,p_attempt_id,p_answers,
   p_attempt_number,p_is_retake,p_retake_count);
end;
$$;
revoke all on function public.cnseb_submit_exam_attempt_secure(uuid,integer,uuid,jsonb,integer,boolean,integer,text,uuid) from public,anon;
grant execute on function public.cnseb_submit_exam_attempt_secure(uuid,integer,uuid,jsonb,integer,boolean,integer,text,uuid) to authenticated;
