-- Campus Nexus multi-institution administration
-- Applied to the Digital Campus Supabase project (lwhtjozfsmbyihenfunw),
-- which currently owns the institutions and tenant identity tables used by platform/.
-- All writes in these RPCs are transactional and are authorized by the primary
-- platform-superadmin predicate. The browser never receives service-role access.

create or replace function public.platform_save_institution(
  p_payload jsonb,
  p_modules text[],
  p_plan_name text,
  p_amount numeric,
  p_billing_cycle text,
  p_admin_email text default null
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_id uuid;
  v_item public.institutions%rowtype;
  v_sub_id uuid;
  v_code text;
  v_admin jsonb := null;
  v_email text := lower(trim(coalesce(p_admin_email,'')));
  v_name text := trim(coalesce(p_payload->>'name',''));
  v_short_code text := upper(trim(coalesce(p_payload->>'short_code','')));
  v_slug text := lower(trim(coalesce(p_payload->>'slug','')));
  v_mode text := coalesce(p_payload->>'portal_mode','campus_nexus');
  v_custom_url text := nullif(trim(coalesce(p_payload->>'custom_login_url','')),'');
begin
  if not public.is_current_user_superadmin() then
    raise exception 'Only the Campus Nexus Platform Super Admin can manage institutions' using errcode='42501';
  end if;
  if v_name = '' or v_short_code !~ '^[A-Z0-9-]{2,12}$'
     or v_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' then
    raise exception 'Institution name, code or slug is invalid' using errcode='22023';
  end if;
  if v_mode not in ('campus_nexus','custom_website') then
    raise exception 'Invalid portal mode' using errcode='22023';
  end if;
  if v_mode = 'custom_website' and
     (v_custom_url is null or v_custom_url !~* '^https?://[^[:space:]]+$') then
    raise exception 'A valid HTTPS or HTTP custom login URL is required' using errcode='22023';
  end if;
  if nullif(trim(coalesce(p_payload->>'website_url','')),'') is not null
     and (p_payload->>'website_url') !~* '^https?://[^[:space:]]+$' then
    raise exception 'Website URL must begin with http:// or https://' using errcode='22023';
  end if;
  if nullif(trim(coalesce(p_payload->>'logo_url','')),'') is not null
     and (p_payload->>'logo_url') !~* '^https://[^[:space:]]+$' then
    raise exception 'Logo URL must use HTTPS' using errcode='22023';
  end if;
  if p_amount is null or p_amount < 0 or p_billing_cycle not in ('monthly','quarterly','annually','custom') then
    raise exception 'Subscription amount or billing cycle is invalid' using errcode='22023';
  end if;
  if p_plan_name is null or length(trim(p_plan_name)) = 0 then
    raise exception 'Subscription plan is required' using errcode='22023';
  end if;
  if exists (select 1 from unnest(coalesce(p_modules,array[]::text[])) x where x !~ '^[a-z][a-z0-9_]{1,63}$') then
    raise exception 'One or more module keys are invalid' using errcode='22023';
  end if;

  if nullif(p_payload->>'id','') is not null then
    v_id := (p_payload->>'id')::uuid;
    update public.institutions set
      name=v_name, short_code=v_short_code, slug=v_slug,
      institution_type=coalesce(nullif(p_payload->>'institution_type',''),'college'),
      country=coalesce(nullif(trim(p_payload->>'country'),''),'Kenya'),
      contact_email=nullif(trim(p_payload->>'contact_email'),''),
      admin_email=case when v_email='' then admin_email else v_email end,
      contact_phone=nullif(trim(p_payload->>'contact_phone'),''),
      website_url=nullif(trim(p_payload->>'website_url'),''),
      logo_url=nullif(trim(p_payload->>'logo_url'),''),
      portal_domain=nullif(trim(p_payload->>'portal_domain'),''),
      primary_color=coalesce(nullif(p_payload->>'primary_color',''),'#082f49'),
      secondary_color=coalesce(nullif(p_payload->>'secondary_color',''),'#0f766e'),
      brand_colors=coalesce(p_payload->'brand_colors','[]'::jsonb),
      portal_mode=v_mode, custom_login_url=case when v_mode='custom_website' then v_custom_url else null end,
      administrator_portal_url=nullif(trim(p_payload->>'administrator_portal_url'),''),
      status=coalesce(nullif(p_payload->>'status',''),'pending'),
      onboarding_status='configuring', updated_at=now()
    where id=v_id returning * into v_item;
    if not found then raise exception 'Institution not found' using errcode='P0002'; end if;
  else
    insert into public.institutions(
      name,short_code,slug,institution_type,country,contact_email,admin_email,contact_phone,
      website_url,logo_url,portal_domain,primary_color,secondary_color,brand_colors,
      portal_mode,custom_login_url,administrator_portal_url,status,onboarding_status,created_by
    ) values (
      v_name,v_short_code,v_slug,coalesce(nullif(p_payload->>'institution_type',''),'college'),
      coalesce(nullif(trim(p_payload->>'country'),''),'Kenya'),
      nullif(trim(p_payload->>'contact_email'),''),nullif(v_email,''),
      nullif(trim(p_payload->>'contact_phone'),''),nullif(trim(p_payload->>'website_url'),''),
      nullif(trim(p_payload->>'logo_url'),''),nullif(trim(p_payload->>'portal_domain'),''),
      coalesce(nullif(p_payload->>'primary_color',''),'#082f49'),
      coalesce(nullif(p_payload->>'secondary_color',''),'#0f766e'),
      coalesce(p_payload->'brand_colors','[]'::jsonb),v_mode,
      case when v_mode='custom_website' then v_custom_url else null end,
      nullif(trim(p_payload->>'administrator_portal_url'),''),
      coalesce(nullif(p_payload->>'status',''),'pending'),'configuring',auth.uid()
    ) returning * into v_item;
    v_id := v_item.id;
  end if;

  insert into public.institution_modules(institution_id,module_key,enabled,updated_at)
  select v_id, known.module_key, (known.module_key = any(coalesce(p_modules,array[]::text[]))), now()
  from unnest(array[
    'student_management','lecturer_portal','administrator_portal','academic_management',
    'examinations','admin_exams','proctoring','transcripts_certificates','admissions',
    'attendance','learning_management','finance','human_resources','library','analytics_reports'
  ]) as known(module_key)
  on conflict(institution_id,module_key) do update
    set enabled=excluded.enabled,updated_at=now();

  select id into v_sub_id from public.institution_subscriptions
   where institution_id=v_id order by created_at desc limit 1 for update;
  if v_sub_id is null then
    insert into public.institution_subscriptions(institution_id,plan_name,amount,currency,billing_cycle,status)
    values(v_id,trim(p_plan_name),p_amount,'KES',p_billing_cycle,'active')
    returning id into v_sub_id;
  else
    update public.institution_subscriptions set
      plan_name=trim(p_plan_name),amount=p_amount,currency='KES',
      billing_cycle=p_billing_cycle,status='active',updated_at=now()
    where id=v_sub_id;
  end if;

  select code into v_code from public.institution_registration_links
   where institution_id=v_id and is_active=true
     and (expires_at is null or expires_at>now())
   order by created_at desc limit 1;
  if v_code is null or length(v_code)<40 then
    update public.institution_registration_links set is_active=false
     where institution_id=v_id and is_active=true;
    v_code := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
    insert into public.institution_registration_links(institution_id,code,label,is_active,created_by)
    values(v_id,v_code,v_name || ' public registration',true,auth.uid());
  end if;

  if v_email <> '' then
    v_admin := public.platform_assign_institution_admin(v_id,v_email);
  end if;

  insert into public.platform_audit_logs(actor_user_id,institution_id,action,entity_type,entity_id,details)
  values(auth.uid(),v_id,
    case when p_payload ? 'id' then 'institution_updated' else 'institution_created' end,
    'institution',v_id,
    jsonb_build_object('name',v_name,'short_code',v_short_code,'status',v_item.status,
      'modules',coalesce(p_modules,array[]::text[]),'subscription_plan',trim(p_plan_name),
      'admin_email',nullif(v_email,'')));

  return jsonb_build_object(
    'institution',to_jsonb(v_item),
    'registration_code',v_code,
    'subscription_id',v_sub_id,
    'admin_assignment',v_admin
  );
end;
$$;

create or replace function public.platform_set_institution_status(
  p_institution_id uuid,
  p_status text
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_old text;
  v_name text;
begin
  if not public.is_current_user_superadmin() then
    raise exception 'Only the Campus Nexus Platform Super Admin can change institution status' using errcode='42501';
  end if;
  if p_status not in ('active','pending','suspended') then
    raise exception 'Invalid institution status' using errcode='22023';
  end if;
  select status,name into v_old,v_name from public.institutions
   where id=p_institution_id for update;
  if not found then raise exception 'Institution not found' using errcode='P0002'; end if;
  update public.institutions set status=p_status,updated_at=now()
   where id=p_institution_id;
  insert into public.platform_audit_logs(actor_user_id,institution_id,action,entity_type,entity_id,details)
  values(auth.uid(),p_institution_id,'institution_'||p_status,'institution',p_institution_id,
    jsonb_build_object('name',v_name,'previous_status',v_old,'new_status',p_status));
  return jsonb_build_object('institution_id',p_institution_id,'status',p_status,'previous_status',v_old);
end;
$$;

revoke all on function public.platform_save_institution(jsonb,text[],text,numeric,text,text) from public, anon;
grant execute on function public.platform_save_institution(jsonb,text[],text,numeric,text,text) to authenticated;
revoke all on function public.platform_set_institution_status(uuid,text) from public, anon;
grant execute on function public.platform_set_institution_status(uuid,text) to authenticated;
