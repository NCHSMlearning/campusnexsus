-- Keep one canonical student profile across registration, admin editing,
-- student portal views and legacy student-module tables.

CREATE OR REPLACE FUNCTION public.sync_student_profile_to_student_record()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $function$
DECLARE
  v_previous_sync text := current_setting('app.is_consolidated_sync', true);
BEGIN
  IF lower(coalesce(NEW.role,'')) <> 'student' OR NEW.institution_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF v_previous_sync = 't' THEN RETURN NEW; END IF;

  PERFORM set_config('app.is_consolidated_sync','t',true);
  UPDATE public.students
     SET full_name=NEW.full_name,email=NEW.email,phone=NEW.phone,course=NEW.program,
         status=NEW.status,
         admission_number=coalesce(nullif(NEW.admission_number,''),nullif(NEW.student_id,'')),
         block=NEW.block,intake_year=NEW.intake_year,current_block=NEW.current_block,
         institution_id=NEW.institution_id
   WHERE user_id=NEW.user_id AND institution_id=NEW.institution_id;

  IF NOT FOUND THEN
    INSERT INTO public.students (
      id,user_id,full_name,email,phone,course,status,admission_number,
      block,intake_year,current_block,institution_id
    ) VALUES (
      gen_random_uuid(),NEW.user_id,NEW.full_name,NEW.email,NEW.phone,NEW.program,
      coalesce(NEW.status,'pending'),
      coalesce(nullif(NEW.admission_number,''),nullif(NEW.student_id,'')),
      NEW.block,NEW.intake_year,NEW.current_block,NEW.institution_id
    );
  END IF;
  PERFORM set_config('app.is_consolidated_sync',coalesce(v_previous_sync,'f'),true);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.is_consolidated_sync',coalesce(v_previous_sync,'f'),true);
  RAISE;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sync_student_profile_to_student_record
  ON public.consolidated_user_profiles_table;
CREATE TRIGGER trg_sync_student_profile_to_student_record
AFTER INSERT OR UPDATE OF full_name,email,phone,program,status,admission_number,student_id,
  block,intake_year,current_block,institution_id
ON public.consolidated_user_profiles_table
FOR EACH ROW EXECUTE FUNCTION public.sync_student_profile_to_student_record();

-- Student creation first inserts into students. That legacy table has an
-- AFTER INSERT sync trigger which can create a minimal consolidated profile.
-- Therefore the auth registration trigger must merge every field from auth
-- metadata even when the consolidated row already exists.
DO $repair_student_registration_profile$
DECLARE
  fn text;
  marker text := '  elsif v_role = ''lecturer'' then';
  injected text := $upsert$
    INSERT INTO public.consolidated_user_profiles_table (
      user_id,email,full_name,phone,role,program,program_type,status,
      intake_year,intake_month,block,current_block,admission_number,student_id,
      institution_id,login_enabled,gender,date_of_birth,admission_date,
      admission_year,national_id,address,guardian_name,guardian_phone,alt_phone,
      doc_id,doc_kcse
    )
    VALUES (
      new.id,lower(new.email),v_full_name,
      nullif(trim(v_meta->>'phone'),''),'student',v_program,
      coalesce(nullif(trim(v_meta->>'program_type'),''),v_program),'pending',
      nullif(trim(v_meta->>'intake_year'),''),
      nullif(trim(v_meta->>'intake_month'),''),
      coalesce(nullif(trim(v_meta->>'block'),''),nullif(trim(v_meta->>'current_block'),'')),
      coalesce(nullif(trim(v_meta->>'current_block'),''),'Introductory'),
      v_admission_number,v_admission_number,v_institution_id,false,
      nullif(trim(v_meta->>'gender'),''),
      nullif(trim(v_meta->>'date_of_birth'),'')::date,
      nullif(trim(v_meta->>'admission_date'),'')::date,
      nullif(trim(v_meta->>'admission_year'),''),
      nullif(trim(v_meta->>'national_id'),''),
      nullif(trim(v_meta->>'address'),''),
      nullif(trim(v_meta->>'guardian_name'),''),
      nullif(trim(v_meta->>'guardian_phone'),''),
      nullif(trim(v_meta->>'alt_phone'),''),
      coalesce(nullif(trim(v_meta->>'doc_id'),''),'pending'),
      coalesce(nullif(trim(v_meta->>'doc_kcse'),''),'pending')
    )
    ON CONFLICT (user_id) DO UPDATE SET
      email=excluded.email,full_name=excluded.full_name,
      phone=coalesce(excluded.phone,consolidated_user_profiles_table.phone),
      role='student',
      program=coalesce(excluded.program,consolidated_user_profiles_table.program),
      program_type=coalesce(excluded.program_type,consolidated_user_profiles_table.program_type),
      intake_year=coalesce(excluded.intake_year,consolidated_user_profiles_table.intake_year),
      intake_month=coalesce(excluded.intake_month,consolidated_user_profiles_table.intake_month),
      block=coalesce(excluded.block,consolidated_user_profiles_table.block),
      current_block=coalesce(excluded.current_block,consolidated_user_profiles_table.current_block),
      admission_number=coalesce(excluded.admission_number,consolidated_user_profiles_table.admission_number),
      student_id=coalesce(excluded.student_id,consolidated_user_profiles_table.student_id),
      institution_id=excluded.institution_id,
      gender=coalesce(excluded.gender,consolidated_user_profiles_table.gender),
      date_of_birth=coalesce(excluded.date_of_birth,consolidated_user_profiles_table.date_of_birth),
      admission_date=coalesce(excluded.admission_date,consolidated_user_profiles_table.admission_date),
      admission_year=coalesce(excluded.admission_year,consolidated_user_profiles_table.admission_year),
      national_id=coalesce(excluded.national_id,consolidated_user_profiles_table.national_id),
      address=coalesce(excluded.address,consolidated_user_profiles_table.address),
      guardian_name=coalesce(excluded.guardian_name,consolidated_user_profiles_table.guardian_name),
      guardian_phone=coalesce(excluded.guardian_phone,consolidated_user_profiles_table.guardian_phone),
      alt_phone=coalesce(excluded.alt_phone,consolidated_user_profiles_table.alt_phone),
      doc_id=coalesce(excluded.doc_id,consolidated_user_profiles_table.doc_id),
      doc_kcse=coalesce(excluded.doc_kcse,consolidated_user_profiles_table.doc_kcse),
      updated_at=now();
$upsert$;
BEGIN
  fn := pg_get_functiondef('public.handle_campus_nexus_auth_user_created()'::regprocedure);
  IF position(marker in fn)=0 THEN
    RAISE EXCEPTION 'Could not locate student/lecturer branch in registration trigger';
  END IF;
  IF position('INSERT INTO public.consolidated_user_profiles_table (' in fn)>0
     AND position('guardian_phone=coalesce(excluded.guardian_phone' in fn)>0 THEN
    RETURN;
  END IF;
  fn := replace(fn,marker,injected||marker);
  EXECUTE fn;
END
$repair_student_registration_profile$;
