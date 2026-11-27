-- Super Admin can independently enable or disable an institution's Exam and LMS products.
-- Product access remains enforced by institution_modules and the existing RLS entitlement policies.
create or replace function public.platform_set_institution_product_access(
  p_institution_id uuid, p_product text, p_enabled boolean
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_name text;
  v_product text := lower(trim(coalesce(p_product,'')));
  v_keys text[];
  v_previous jsonb := '{}'::jsonb;
  v_updated jsonb := '{}'::jsonb;
  v_key text;
begin
  if auth.uid() is null or not public.is_current_user_superadmin() then
    raise exception 'Only the Campus Nexus Platform Super Admin can change product access' using errcode='42501';
  end if;
  if p_institution_id is null or p_enabled is null then
    raise exception 'Institution and enabled state are required' using errcode='22023';
  end if;
  if v_product = 'exams' then v_keys := array['examinations','admin_exams','proctoring'];
  elsif v_product = 'lms' then v_keys := array['learning_management'];
  else raise exception 'Product must be exams or lms' using errcode='22023';
  end if;
  select name into v_name from public.institutions where id=p_institution_id for update;
  if not found then raise exception 'Institution not found' using errcode='P0002'; end if;
  foreach v_key in array v_keys loop
    v_previous := jsonb_set(v_previous,array[v_key],to_jsonb(coalesce((
      select enabled from public.institution_modules
      where institution_id=p_institution_id and module_key=v_key
    ),false)),true);
    insert into public.institution_modules(institution_id,module_key,enabled,updated_at)
    values(p_institution_id,v_key,p_enabled,now())
    on conflict(institution_id,module_key) do update set enabled=excluded.enabled,updated_at=now();
    v_updated := jsonb_set(v_updated,array[v_key],to_jsonb(p_enabled),true);
  end loop;
  insert into public.platform_audit_logs(actor_user_id,institution_id,action,entity_type,entity_id,details)
  values(auth.uid(),p_institution_id,
    case when v_product='exams' then 'institution_exam_access_changed' else 'institution_lms_access_changed' end,
    'institution',p_institution_id,
    jsonb_build_object('institution_name',v_name,'product',v_product,'previous_modules',v_previous,'new_modules',v_updated,'enabled',p_enabled));
  return jsonb_build_object('success',true,'institution_id',p_institution_id,'institution_name',v_name,
    'product',v_product,'enabled',p_enabled,'previous_modules',v_previous,'modules',v_updated);
end;
$$;
revoke all on function public.platform_set_institution_product_access(uuid,text,boolean) from public, anon;
grant execute on function public.platform_set_institution_product_access(uuid,text,boolean) to authenticated;
