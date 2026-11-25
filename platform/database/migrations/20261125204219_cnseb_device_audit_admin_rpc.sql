create or replace function public.cnseb_admin_list_audit(p_institution_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path='pg_catalog','public','private','auth'
set row_security=off
as $$
declare v_rows jsonb;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not private.is_primary_superadmin()
    and (p_institution_id is null or not private.has_active_institution_admin_access(p_institution_id)) then
   raise exception 'Institution administrator access required' using errcode='42501';
 end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',a.id,'event_type',a.event_type,'actor_id',a.actor_id,
   'device_registration_id',a.device_registration_id,'details',a.details,'created_at',a.created_at
 ) order by a.created_at desc),'[]'::jsonb)
 into v_rows from public.cnseb_device_audit a
 where (private.is_primary_superadmin() and (p_institution_id is null or a.institution_id=p_institution_id))
    or (not private.is_primary_superadmin() and a.institution_id=p_institution_id);
 return jsonb_build_object('events',v_rows,'generated_at',now());
end;
$$;
revoke all on function public.cnseb_admin_list_audit(uuid) from public,anon;
grant execute on function public.cnseb_admin_list_audit(uuid) to authenticated;
revoke select on public.cnseb_device_audit from authenticated;
