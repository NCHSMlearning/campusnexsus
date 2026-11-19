create table if not exists private.platform_operator_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  permission_key text not null check (permission_key in (
    'institutions.view','institutions.manage','users.view','users.manage',
    'billing.view','billing.manage','security.view','audit.view','platform.settings.manage'
  )),
  institution_id uuid null references public.institutions(id) on delete cascade,
  granted_by uuid not null references auth.users(id),
  granted_at timestamptz not null default now(),
  revoked_by uuid null references auth.users(id),
  revoked_at timestamptz null,
  note text null,
  constraint platform_operator_permission_revoke_pair check ((revoked_at is null) = (revoked_by is null))
);
create unique index if not exists platform_operator_permissions_active_unique
  on private.platform_operator_permissions(user_id, permission_key, coalesce(institution_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where revoked_at is null;
create index if not exists platform_operator_permissions_user_active_idx
  on private.platform_operator_permissions(user_id, permission_key) where revoked_at is null;
alter table private.platform_operator_permissions enable row level security;
revoke all on private.platform_operator_permissions from public, anon, authenticated;
grant usage on schema private to authenticated;
create or replace function private.platform_operator_has_permission(p_permission_key text, p_institution_id uuid default null)
returns boolean language sql stable security definer set search_path = pg_catalog, auth, private
as $$
  select auth.uid() is not null and exists (
    select 1 from private.platform_operator_permissions p
    where p.user_id=auth.uid() and p.permission_key=p_permission_key and p.revoked_at is null
      and (p.institution_id is null or p.institution_id=p_institution_id)
  );
$$;
revoke all on function private.platform_operator_has_permission(text,uuid) from public, anon;
grant execute on function private.platform_operator_has_permission(text,uuid) to authenticated;
create or replace function public.platform_operator_user_search(p_search text default null)
returns jsonb language plpgsql security definer set search_path=pg_catalog,auth,public,private
as $$
declare v_result jsonb;
begin
 if auth.uid() is null or not private.is_primary_superadmin() then raise exception 'Only the primary platform superadmin can search operator candidates' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('user_id',x.user_id,'full_name',x.full_name,'email',x.email,'role',x.role,'institution_name',x.institution_name) order by x.full_name),'[]'::jsonb)
 into v_result from (
  select distinct on(p.user_id) p.user_id,p.full_name,p.email,p.role,i.name institution_name
  from public.consolidated_user_profiles_table p left join public.institutions i on i.id=p.institution_id
  where p.user_id is not null and (coalesce(trim(p_search),'')='' or p.full_name ilike '%'||trim(p_search)||'%' or p.email ilike '%'||trim(p_search)||'%')
  order by p.user_id,p.updated_at desc nulls last limit 25
 ) x;
 return v_result;
end; $$;
revoke all on function public.platform_operator_user_search(text) from public,anon;
grant execute on function public.platform_operator_user_search(text) to authenticated;
create or replace function public.platform_operator_permissions_directory()
returns jsonb language plpgsql security definer set search_path=pg_catalog,auth,public,private
as $$
declare v_result jsonb;
begin
 if auth.uid() is null or not private.is_primary_superadmin() then raise exception 'Only the primary platform superadmin can view operator permissions' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'user_id',p.user_id,'email',u.email,'full_name',cp.full_name,'permission_key',p.permission_key,'institution_id',p.institution_id,'institution_name',i.name,'granted_at',p.granted_at,'granted_by',p.granted_by,'note',p.note) order by cp.full_name,p.permission_key),'[]'::jsonb)
 into v_result from private.platform_operator_permissions p join auth.users u on u.id=p.user_id
 left join lateral(select z.full_name from public.consolidated_user_profiles_table z where z.user_id=p.user_id order by z.updated_at desc nulls last limit 1) cp on true
 left join public.institutions i on i.id=p.institution_id where p.revoked_at is null;
 return v_result;
end; $$;
revoke all on function public.platform_operator_permissions_directory() from public,anon;
grant execute on function public.platform_operator_permissions_directory() to authenticated;
create or replace function public.platform_manage_operator_permission(
 p_user_id uuid,p_permission_key text,p_institution_id uuid default null,p_action text default 'grant',p_note text default null
) returns jsonb language plpgsql security definer set search_path=pg_catalog,auth,public,private
as $$
declare v_existing private.platform_operator_permissions%rowtype;
begin
 if auth.uid() is null or not private.is_primary_superadmin() then raise exception 'Only the primary platform superadmin can manage operator permissions' using errcode='42501'; end if;
 if p_user_id is null or p_user_id=auth.uid() then raise exception 'Select another valid user account' using errcode='22023'; end if;
 if p_permission_key not in ('institutions.view','institutions.manage','users.view','users.manage','billing.view','billing.manage','security.view','audit.view','platform.settings.manage') then raise exception 'Unsupported platform permission' using errcode='22023'; end if;
 if p_action not in ('grant','revoke') then raise exception 'Action must be grant or revoke' using errcode='22023'; end if;
 if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'The selected user account does not exist' using errcode='22023'; end if;
 if p_institution_id is not null and not exists(select 1 from public.institutions where id=p_institution_id) then raise exception 'The selected institution does not exist' using errcode='22023'; end if;
 if p_action='grant' then
  insert into private.platform_operator_permissions(user_id,permission_key,institution_id,granted_by,note)
  values(p_user_id,p_permission_key,p_institution_id,auth.uid(),nullif(left(trim(coalesce(p_note,'')),500),''))
  on conflict (user_id,permission_key,(coalesce(institution_id,'00000000-0000-0000-0000-000000000000'::uuid))) where revoked_at is null
  do update set note=excluded.note returning * into v_existing;
  insert into public.platform_audit_logs(actor_user_id,institution_id,action,entity_type,entity_id,details)
  values(auth.uid(),p_institution_id,'platform_operator_permission_granted','platform_operator_permission',v_existing.id,jsonb_build_object('target_user_id',p_user_id,'permission_key',p_permission_key,'scope_institution_id',p_institution_id,'note',p_note));
  return jsonb_build_object('success',true,'message','Platform permission granted.');
 else
  update private.platform_operator_permissions set revoked_at=now(),revoked_by=auth.uid()
  where user_id=p_user_id and permission_key=p_permission_key and institution_id is not distinct from p_institution_id and revoked_at is null returning * into v_existing;
  if not found then return jsonb_build_object('success',false,'message','No matching active permission was found.'); end if;
  insert into public.platform_audit_logs(actor_user_id,institution_id,action,entity_type,entity_id,details)
  values(auth.uid(),p_institution_id,'platform_operator_permission_revoked','platform_operator_permission',v_existing.id,jsonb_build_object('target_user_id',p_user_id,'permission_key',p_permission_key,'scope_institution_id',p_institution_id,'note',p_note));
  return jsonb_build_object('success',true,'message','Platform permission revoked.');
 end if;
end; $$;
revoke all on function public.platform_manage_operator_permission(uuid,text,uuid,text,text) from public,anon;
grant execute on function public.platform_manage_operator_permission(uuid,text,uuid,text,text) to authenticated;