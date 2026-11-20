-- Extend module entitlement enforcement to admissions, LMS assignments,
-- transcripts and tenant-linked finance records.
do $$
declare t text; expr text;
 direct_rules jsonb := jsonb_build_object(
  'applications','private.module_entitlement_allows((select p.institution_id from public.consolidated_user_profiles_table p where p.user_id=applications.user_id), ''admissions'')',
  'application_documents','private.module_entitlement_allows((select p.institution_id from public.consolidated_user_profiles_table p where p.user_id=application_documents.user_id), ''admissions'')',
  'application_logs','private.module_entitlement_allows((select p.institution_id from public.consolidated_user_profiles_table p where p.user_id=application_logs.user_id), ''admissions'')',
  'online_assignments','private.module_entitlement_allows((select p.institution_id from public.consolidated_user_profiles_table p where p.user_id=online_assignments.created_by), ''learning_management'')',
  'online_learning_assignments','private.module_entitlement_allows((select p.institution_id from public.consolidated_user_profiles_table p where p.user_id=online_learning_assignments.created_by), ''learning_management'')',
  'transcript_verification_registry','private.module_entitlement_allows((select p.institution_id from public.consolidated_user_profiles_table p where p.user_id=transcript_verification_registry.student_user_id), ''transcripts_certificates'')',
  'finance_invoices','private.module_entitlement_allows((select p.institution_id from public.consolidated_user_profiles_table p where p.user_id=finance_invoices.student_id), ''finance'')',
  'finance_payments','private.module_entitlement_allows((select p.institution_id from public.consolidated_user_profiles_table p where p.user_id=finance_payments.student_id), ''finance'')',
  'finance_transactions','private.module_entitlement_allows((select p.institution_id from public.consolidated_user_profiles_table p where p.user_id=finance_transactions.student_id), ''finance'')',
  'finance_student_transactions','private.module_entitlement_allows((select p.institution_id from public.consolidated_user_profiles_table p where p.user_id=finance_student_transactions.student_id), ''finance'')',
  'finance_fee_structure','private.module_entitlement_allows((select p.institution_id from public.consolidated_user_profiles_table p where p.user_id=finance_fee_structure.created_by), ''finance'')'
 );
begin
 for t,expr in select key,value #>> '{}' from jsonb_each(direct_rules) loop
  if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname=t and c.relkind in ('r','p')) then
   execute format('drop policy if exists cn_module_entitlement_guard on public.%I',t);
   execute format('create policy cn_module_entitlement_guard on public.%I as restrictive for all to authenticated using (%s) with check (%s)',t,expr,expr);
  end if;
 end loop;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='online_assignment_questions' and c.relkind in ('r','p')) then
  expr:='private.module_entitlement_allows((select p.institution_id from public.online_assignments a join public.consolidated_user_profiles_table p on p.user_id=a.created_by where a.id=online_assignment_questions.assignment_id), ''learning_management'')';
  execute 'drop policy if exists cn_module_entitlement_guard on public.online_assignment_questions';
  execute format('create policy cn_module_entitlement_guard on public.online_assignment_questions as restrictive for all to authenticated using (%s) with check (%s)',expr,expr);
 end if;
end;
$$;
