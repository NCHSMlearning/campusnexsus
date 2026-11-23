-- Extend Campus Nexus auth-user provisioning to create lecturer records.
-- Lecturer accounts remain pending and login-disabled until approved.
CREATE OR REPLACE FUNCTION public.handle_campus_nexus_auth_user_created()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_role text := lower(coalesce(v_meta->>'role', ''));
  v_source text := coalesce(v_meta->>'registration_source', '');
  v_school_code text := coalesce(nullif(trim(v_meta->>'school_code'), ''), nullif(trim(v_meta->>'institution_code'), ''));
  v_institution_id uuid;
  v_full_name text := nullif(trim(v_meta->>'full_name'), '');
  v_program text := nullif(trim(v_meta->>'program'), '');
  v_admission_number text := nullif(trim(v_meta->>'student_id'), '');
  v_staff_id text;
begin
  if v_source <> 'campus_nexus_school_registration' or v_role not in ('student', 'lecturer') then return new; end if;
  if new.email is null then raise exception 'Institution registration requires an email address'; end if;

  select i.id into v_institution_id
  from public.institutions i
  where upper(regexp_replace(coalesce(i.school_code, ''), '[[:space:]-]+', '', 'g')) =
        upper(regexp_replace(coalesce(v_school_code, ''), '[[:space:]-]+', '', 'g'))
    and lower(coalesce(i.status, '')) = 'active'
  limit 1;
  if v_institution_id is null then raise exception 'No active institution matches the supplied school code'; end if;
  if v_full_name is null then v_full_name := split_part(new.email, '@', 1); end if;

  if v_role = 'student' then
    insert into public.students (user_id,full_name,email,phone,course,status,admission_number,block,intake_year,current_block,institution_id)
    values (new.id,v_full_name,lower(new.email),nullif(trim(v_meta->>'phone'),''),v_program,'pending',v_admission_number,
      coalesce(nullif(trim(v_meta->>'block'),''),'pending'),coalesce(nullif(trim(v_meta->>'intake_year'),''),'pending'),
      coalesce(nullif(trim(v_meta->>'current_block'),''),'Introductory'),v_institution_id)
    on conflict do nothing;

    if not exists (select 1 from public.consolidated_user_profiles_table p where p.user_id=new.id) then
      insert into public.consolidated_user_profiles_table (
        user_id,email,full_name,phone,role,program,status,intake_year,block,current_block,admission_number,student_id,
        institution_id,login_enabled,gender,date_of_birth,admission_date,admission_year,intake_month,national_id,address,
        guardian_name,guardian_phone,alt_phone,doc_id,doc_kcse
      ) values (
        new.id,lower(new.email),v_full_name,nullif(trim(v_meta->>'phone'),''),'student',v_program,'pending',
        nullif(trim(v_meta->>'intake_year'),''),nullif(trim(v_meta->>'block'),''),
        coalesce(nullif(trim(v_meta->>'current_block'),''),'Introductory'),v_admission_number,v_admission_number,
        v_institution_id,false,nullif(trim(v_meta->>'gender'),''),
        nullif(trim(v_meta->>'date_of_birth'),'')::date,nullif(trim(v_meta->>'admission_date'),'')::date,
        nullif(trim(v_meta->>'admission_year'),''),nullif(trim(v_meta->>'intake_month'),''),
        nullif(trim(v_meta->>'national_id'),''),nullif(trim(v_meta->>'address'),''),
        nullif(trim(v_meta->>'guardian_name'),''),nullif(trim(v_meta->>'guardian_phone'),''),
        nullif(trim(v_meta->>'alt_phone'),''),coalesce(nullif(trim(v_meta->>'doc_id'),''),'pending'),
        coalesce(nullif(trim(v_meta->>'doc_kcse'),''),'pending')
      ) on conflict (user_id) do nothing;
    end if;

  elsif v_role = 'lecturer' then
    v_staff_id := 'PENDING-' || upper(substr(replace(new.id::text,'-',''),1,8));
    if exists (select 1 from public.lecturers l where lower(l.email)=lower(new.email) and l.user_id is not null and l.user_id<>new.id) then
      raise exception 'A lecturer record already exists for this email address';
    end if;

    insert into public.consolidated_user_profiles_table (
      user_id,email,full_name,phone,role,department,program,status,staff_id,institution_id,login_enabled,gender,
      date_of_birth,national_id,address,alt_phone,employment_date,doc_lecturer_id,doc_kra_pin,doc_university_cert,doc_cv
    ) values (
      new.id,lower(new.email),v_full_name,nullif(trim(v_meta->>'phone'),''),'lecturer',
      nullif(trim(v_meta->>'department'),''),v_program,'pending',v_staff_id,v_institution_id,false,
      nullif(trim(v_meta->>'gender'),''),nullif(trim(v_meta->>'date_of_birth'),'')::date,
      nullif(trim(v_meta->>'national_id'),''),nullif(trim(v_meta->>'address'),''),
      nullif(trim(v_meta->>'alt_phone'),''),nullif(trim(v_meta->>'employment_date'),'')::date,
      coalesce(nullif(trim(v_meta->>'doc_lecturer_id'),''),'pending'),
      coalesce(nullif(trim(v_meta->>'doc_kra_pin'),''),'pending'),
      coalesce(nullif(trim(v_meta->>'doc_university_cert'),''),'pending'),
      coalesce(nullif(trim(v_meta->>'doc_cv'),''),'pending')
    ) on conflict (user_id) do nothing;

    insert into public.lecturers (user_id,full_name,email,phone,department,status,approved,staff_id,role,institution_id)
    values (new.id,v_full_name,lower(new.email),nullif(trim(v_meta->>'phone'),''),nullif(trim(v_meta->>'department'),''),
      'pending',false,v_staff_id,'lecturer',v_institution_id)
    on conflict (email) do update set user_id=excluded.user_id,full_name=excluded.full_name,phone=excluded.phone,
      department=excluded.department,status='pending',approved=false,role='lecturer',institution_id=excluded.institution_id
    where public.lecturers.user_id is null or public.lecturers.user_id=excluded.user_id;
  end if;
  return new;
end;
$function$;
