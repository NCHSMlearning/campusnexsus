-- Keep clinical placement records independent of cross-tenant student foreign keys.
-- Student identity is stored as an institution-local name/admission-number snapshot.
alter table public.institution_clinical_placements drop constraint if exists institution_clinical_placements_student_id_fkey;
alter table public.institution_clinical_placements drop column if exists student_id;

grant select, insert, update, delete on public.institution_admissions, public.institution_hr_records, public.institution_timetable_entries, public.institution_clinical_placements, public.institution_research_projects, public.institution_welfare_cases to authenticated;
