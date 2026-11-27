-- Permit an active institution administrator to review only that institution's
-- student session reports. Student submissions already stamp institution_id.
do $$
begin
  if to_regclass('public.session_reports') is not null
     and exists (
       select 1 from information_schema.columns
       where table_schema='public' and table_name='session_reports' and column_name='institution_id'
     ) then
    execute 'alter table public.session_reports enable row level security';
    execute 'drop policy if exists institution_admin_session_reports_tenant on public.session_reports';
    execute $policy$
      create policy institution_admin_session_reports_tenant
      on public.session_reports
      for all
      to authenticated
      using (
        institution_id is not null
        and private.has_active_institution_admin_access(institution_id)
        and private.module_entitlement_allows(institution_id, 'student_management')
      )
      with check (
        institution_id is not null
        and private.has_active_institution_admin_access(institution_id)
        and private.module_entitlement_allows(institution_id, 'student_management')
      )
    $policy$;
  end if;
end $$;
