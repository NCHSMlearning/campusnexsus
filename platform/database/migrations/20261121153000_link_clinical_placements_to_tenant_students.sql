-- Link clinical placements to a student in the same institution only.
-- The composite FK prevents an institution administrator from assigning another
-- institution's student to a placement, even if a foreign UUID is submitted.
create unique index if not exists students_id_institution_uidx
  on public.students(id, institution_id);

alter table public.institution_clinical_placements
  add column if not exists student_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'institution_clinical_placements_student_tenant_fk'
  ) then
    alter table public.institution_clinical_placements
      add constraint institution_clinical_placements_student_tenant_fk
      foreign key (student_id, institution_id)
      references public.students(id, institution_id)
      on delete set null (student_id);
  end if;
end $$;

create index if not exists institution_clinical_student_idx
  on public.institution_clinical_placements(institution_id, student_id);
