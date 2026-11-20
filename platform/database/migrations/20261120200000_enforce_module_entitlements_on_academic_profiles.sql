-- Apply product entitlements to shared academic identity and marks records.
do $$
declare expr text;
begin
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='consolidated_user_profiles_table' and c.relkind in ('r','p')) then
  expr:='private.module_entitlement_allows_any(institution_id, array[''student_management'',''lecturer_portal'',''administrator_portal'',''academic_management'',''examinations'',''admin_exams'',''learning_management'',''admissions'',''attendance'',''finance'',''human_resources'',''transcripts_certificates'',''analytics_reports'',''proctoring'']::text[])';
  execute 'drop policy if exists cn_module_entitlement_guard on public.consolidated_user_profiles_table';
  execute format('create policy cn_module_entitlement_guard on public.consolidated_user_profiles_table as restrictive for all to authenticated using (%s) with check (%s)',expr,expr);
 end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='student_marks' and c.relkind in ('r','p')) then
  expr:='private.module_entitlement_allows_any(institution_id, array[''academic_management'',''examinations'',''transcripts_certificates'']::text[])';
  execute 'drop policy if exists cn_module_entitlement_guard on public.student_marks';
  execute format('create policy cn_module_entitlement_guard on public.student_marks as restrictive for all to authenticated using (%s) with check (%s)',expr,expr);
 end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='student_unit_registrations' and c.relkind in ('r','p')) then
  expr:='private.module_entitlement_allows(institution_id, ''academic_management'')';
  execute 'drop policy if exists cn_module_entitlement_guard on public.student_unit_registrations';
  execute format('create policy cn_module_entitlement_guard on public.student_unit_registrations as restrictive for all to authenticated using (%s) with check (%s)',expr,expr);
 end if;
end;
$$;
