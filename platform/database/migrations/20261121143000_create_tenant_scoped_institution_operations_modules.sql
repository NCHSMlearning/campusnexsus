-- Tenant-scoped operational workspaces for institution administrators.
-- Existing legacy applications, timetables, clinical_placements and research_submissions
-- are intentionally not reused because they lack institution_id ownership boundaries.

create table if not exists public.institution_admissions (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
 applicant_name text not null, email text, phone text, programme text, intake text, application_number text,
 status text not null default 'received', notes text, created_by uuid default auth.uid(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.institution_hr_records (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
 staff_name text not null, email text, phone text, department text, designation text, employment_type text,
 start_date date, contract_end_date date, status text not null default 'active', notes text,
 created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.institution_timetable_entries (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
 session_title text not null, programme text, block text, course_name text, lecturer_name text, session_date date not null,
 start_time time not null, end_time time not null, venue text, session_type text default 'lecture',
 created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint institution_timetable_time_check check (end_time > start_time)
);
create table if not exists public.institution_clinical_placements (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
 student_id uuid references public.students(id) on delete set null, student_name text not null, admission_number text,
 facility_name text not null, department text not null, supervisor_name text, start_date date, end_date date,
 required_hours numeric(8,2) not null default 0, status text not null default 'planned', notes text,
 created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint institution_clinical_hours_check check (required_hours >= 0),
 constraint institution_clinical_dates_check check (end_date is null or start_date is null or end_date >= start_date)
);
create table if not exists public.institution_research_projects (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
 project_title text not null, student_name text, admission_number text, supervisor_name text, programme text,
 research_stage text default 'proposal', status text not null default 'in_progress', due_date date, abstract text, feedback text,
 created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.institution_welfare_cases (
 id uuid primary key default gen_random_uuid(), institution_id uuid not null references public.institutions(id) on delete cascade,
 student_name text not null, admission_number text, case_category text not null, priority text not null default 'normal',
 description text not null, assigned_to text, status text not null default 'open', resolution text,
 created_by uuid default auth.uid(), created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create index if not exists institution_admissions_tenant_idx on public.institution_admissions(institution_id, created_at desc);
create index if not exists institution_hr_tenant_idx on public.institution_hr_records(institution_id, created_at desc);
create index if not exists institution_timetable_tenant_idx on public.institution_timetable_entries(institution_id, session_date);
create index if not exists institution_clinical_tenant_idx on public.institution_clinical_placements(institution_id, start_date);
create index if not exists institution_research_tenant_idx on public.institution_research_projects(institution_id, created_at desc);
create index if not exists institution_welfare_tenant_idx on public.institution_welfare_cases(institution_id, created_at desc);

do $$
declare t text; m text;
begin
 for t,m in select * from (values
  ('institution_admissions','admissions'),
  ('institution_hr_records','human_resources'),
  ('institution_timetable_entries','timetable'),
  ('institution_clinical_placements','clinical_placements'),
  ('institution_research_projects','research_management'),
  ('institution_welfare_cases','student_welfare')
 ) as x(table_name,module_key)
 loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists institution_admin_tenant_manage on public.%I',t);
  execute format('create policy institution_admin_tenant_manage on public.%I for all to authenticated using (private.has_active_institution_admin_access(institution_id) and private.module_entitlement_allows(institution_id,%L)) with check (private.has_active_institution_admin_access(institution_id) and private.module_entitlement_allows(institution_id,%L))',t,m,m);
  execute format('drop policy if exists institution_admin_tenant_read on public.%I',t);
  execute format('create policy institution_admin_tenant_read on public.%I for select to authenticated using (private.has_active_institution_admin_access(institution_id) and private.module_entitlement_allows(institution_id,%L))',t,m);
 end loop;
end $$;
