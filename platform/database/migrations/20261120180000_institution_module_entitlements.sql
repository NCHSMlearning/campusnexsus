-- Enforce institution module entitlements in PostgreSQL.
create or replace function private.user_has_institution_module(p_institution_id uuid,p_module_key text)
returns boolean language sql stable security definer
set search_path=pg_catalog,public,auth,private as $$
 select auth.uid() is not null and p_institution_id is not null and exists(
  select 1 from public.institution_users iu
  join public.institutions i on i.id=iu.institution_id
  join public.institution_modules im on im.institution_id=iu.institution_id
  where iu.user_id=auth.uid() and iu.institution_id=p_institution_id
   and lower(trim(coalesce(iu.status,'')))='active'
   and lower(trim(coalesce(i.status,'')))='active'
   and im.module_key=lower(trim(coalesce(p_module_key,''))) and im.enabled is true
 );
$$;
create or replace function private.has_active_institution_membership()
returns boolean language sql stable security definer
set search_path=pg_catalog,public,auth,private as $$
 select auth.uid() is not null and exists(select 1 from public.institution_users iu
  where iu.user_id=auth.uid() and lower(trim(coalesce(iu.status,'')))='active');
$$;
create or replace function private.user_has_institution_module_for_any_membership(p_module_key text)
returns boolean language sql stable security definer
set search_path=pg_catalog,public,auth,private as $$
 select auth.uid() is not null and exists(
  select 1 from public.institution_users iu
  join public.institutions i on i.id=iu.institution_id
  join public.institution_modules im on im.institution_id=iu.institution_id
  where iu.user_id=auth.uid()
   and lower(trim(coalesce(iu.status,'')))='active'
   and lower(trim(coalesce(i.status,'')))='active'
   and im.module_key=lower(trim(coalesce(p_module_key,''))) and im.enabled is true
 );
$$;
create or replace function private.module_entitlement_allows(p_institution_id uuid,p_module_key text)
returns boolean language sql stable security definer
set search_path=pg_catalog,public,auth,private as $$
 select auth.uid() is not null and (private.is_primary_superadmin()
  or not private.has_active_institution_membership()
  or private.user_has_institution_module(p_institution_id,p_module_key));
$$;
create or replace function private.module_entitlement_allows_any(p_institution_id uuid,p_module_keys text[])
returns boolean language sql stable security definer
set search_path=pg_catalog,public,auth,private as $$
 select auth.uid() is not null and (private.is_primary_superadmin()
  or not private.has_active_institution_membership()
  or exists(select 1 from unnest(coalesce(p_module_keys,array[]::text[])) k(module_key)
   where private.user_has_institution_module(p_institution_id,k.module_key)));
$$;
revoke all on function private.user_has_institution_module(uuid,text) from public,anon;
revoke all on function private.has_active_institution_membership() from public,anon;
revoke all on function private.user_has_institution_module_for_any_membership(text) from public,anon;
revoke all on function private.module_entitlement_allows(uuid,text) from public,anon;
revoke all on function private.module_entitlement_allows_any(uuid,text[]) from public,anon;
grant execute on function private.user_has_institution_module(uuid,text) to authenticated;
grant execute on function private.has_active_institution_membership() to authenticated;
grant execute on function private.user_has_institution_module_for_any_membership(text) to authenticated;
grant execute on function private.module_entitlement_allows(uuid,text) to authenticated;
grant execute on function private.module_entitlement_allows_any(uuid,text[]) to authenticated;

create or replace function public.current_user_module_entitlements()
returns text[] language sql stable security invoker
set search_path=pg_catalog,public,auth,private as $$
 select coalesce(array_agg(distinct im.module_key order by im.module_key),array[]::text[])
 from public.institution_users iu join public.institutions i on i.id=iu.institution_id
 join public.institution_modules im on im.institution_id=iu.institution_id
 where auth.uid() is not null and iu.user_id=auth.uid()
  and lower(trim(coalesce(iu.status,'')))='active'
  and lower(trim(coalesce(i.status,'')))='active' and im.enabled is true;
$$;
create or replace function public.current_user_has_module(p_module_key text)
returns boolean language sql stable security invoker
set search_path=pg_catalog,public,auth,private as $$
 select auth.uid() is not null and (private.is_primary_superadmin()
  or private.user_has_institution_module_for_any_membership(lower(trim(coalesce(p_module_key,'')))));
$$;
revoke all on function public.current_user_module_entitlements() from public,anon;
revoke all on function public.current_user_has_module(text) from public,anon;
grant execute on function public.current_user_module_entitlements() to authenticated;
grant execute on function public.current_user_has_module(text) to authenticated;

do $$
declare t text; expr text;
 direct_rules jsonb := jsonb_build_object(
  'exams','private.module_entitlement_allows(institution_id, ''examinations'')',
  'exam_attempts','private.module_entitlement_allows(institution_id, ''examinations'')',
  'exam_proctoring_logs','private.module_entitlement_allows(institution_id, ''proctoring'')',
  'courses','private.module_entitlement_allows_any(institution_id, array[''academic_management'',''learning_management'']::text[])',
  'resources','private.module_entitlement_allows(institution_id, ''learning_management'')',
  'attendance','private.module_entitlement_allows(institution_id, ''attendance'')',
  'geo_attendance_logs','private.module_entitlement_allows(institution_id, ''attendance'')',
  'finance_student_accounts','private.module_entitlement_allows(institution_id, ''finance'')',
  'staff_records','private.module_entitlement_allows(institution_id, ''human_resources'')'
 );
 exam_child text[]:=array['exam_questions','exam_answers','exam_attendance','exam_grades','exam_heartbeats','exam_notifications','exam_results','live_exam_sessions','released_exam_results'];
begin
 for t,expr in select key,value #>> '{}' from jsonb_each(direct_rules) loop
  if to_regclass('public.'||t) is not null then
   execute format('drop policy if exists cn_module_entitlement_guard on public.%I',t);
   execute format('create policy cn_module_entitlement_guard on public.%I as restrictive for all to authenticated using (%s) with check (%s)',t,expr,expr);
  end if;
 end loop;
 foreach t in array exam_child loop
  if to_regclass('public.'||t) is not null then
   expr:='private.module_entitlement_allows((select e.institution_id from public.exams e where e.id=exam_id), ''admin_exams'')';
   if t in ('exam_answers','exam_attendance','exam_grades','exam_notifications','exam_results','live_exam_sessions','released_exam_results') then
    expr:='private.module_entitlement_allows((select e.institution_id from public.exams e where e.id=exam_id), ''examinations'')';
   elsif t='exam_heartbeats' then
    expr:='private.module_entitlement_allows((select e.institution_id from public.exams e where e.id=exam_id), ''proctoring'')';
   end if;
   execute format('drop policy if exists cn_module_entitlement_guard on public.%I',t);
   execute format('create policy cn_module_entitlement_guard on public.%I as restrictive for all to authenticated using (%s) with check (%s)',t,expr,expr);
  end if;
 end loop;
end;
$$;
