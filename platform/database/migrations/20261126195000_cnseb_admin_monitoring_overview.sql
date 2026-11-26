create or replace function public.cnseb_admin_get_overview(p_institution_id uuid default null)
returns jsonb language plpgsql security definer
set search_path='pg_catalog','public','private','auth' set row_security=off
as $$
declare v_is_superadmin boolean; v_devices bigint:=0; v_installations bigint:=0; v_sessions bigint:=0; v_open_events bigint:=0;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 v_is_superadmin:=private.is_primary_superadmin();
 if not v_is_superadmin and (p_institution_id is null or not private.has_active_institution_admin_access(p_institution_id)) then
  raise exception 'Institution administrator access required' using errcode='42501';
 end if;
 select count(*) into v_devices from public.device_registrations d
 where (v_is_superadmin and (p_institution_id is null or d.institution_id=p_institution_id)) or (not v_is_superadmin and d.institution_id=p_institution_id);
 select count(*) into v_installations from public.device_registrations d where d.registration_source='cnseb'
 and ((v_is_superadmin and (p_institution_id is null or d.institution_id=p_institution_id)) or (not v_is_superadmin and d.institution_id=p_institution_id));
 select count(*) into v_sessions from public.live_exam_sessions s join public.exams e on e.id=s.exam_id
 where s.last_heartbeat>now()-interval '90 seconds'
 and ((v_is_superadmin and (p_institution_id is null or e.institution_id=p_institution_id)) or (not v_is_superadmin and e.institution_id=p_institution_id));
 select count(*) into v_open_events from public.exam_proctoring_logs l where coalesce(l.is_read,false)=false
 and ((v_is_superadmin and (p_institution_id is null or l.institution_id=p_institution_id)) or (not v_is_superadmin and l.institution_id=p_institution_id));
 return jsonb_build_object('registered_devices',v_devices,'active_sessions',v_sessions,'app_installations',v_installations,'open_security_events',v_open_events,'generated_at',now());
end; $$;
revoke all on function public.cnseb_admin_get_overview(uuid) from public,anon;
grant execute on function public.cnseb_admin_get_overview(uuid) to authenticated;
