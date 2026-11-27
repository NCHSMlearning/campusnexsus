-- Keep the consolidated student profile as the canonical source of truth.
-- Mirror profile and academic identity fields to the legacy students table so
-- older student modules and the student dashboard always see admin changes.
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
  IF v_previous_sync = 't' THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.is_consolidated_sync','t',true);

  UPDATE public.students
     SET full_name = NEW.full_name,
         email = NEW.email,
         phone = NEW.phone,
         course = NEW.program,
         status = NEW.status,
         admission_number = coalesce(nullif(NEW.admission_number,''), nullif(NEW.student_id,'')),
         block = NEW.block,
         intake_year = NEW.intake_year,
         current_block = NEW.current_block,
         institution_id = NEW.institution_id
   WHERE user_id = NEW.user_id
     AND institution_id = NEW.institution_id;

  IF NOT FOUND THEN
    INSERT INTO public.students (
      id,user_id,full_name,email,phone,course,status,admission_number,
      block,intake_year,current_block,institution_id
    )
    VALUES (
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
FOR EACH ROW
EXECUTE FUNCTION public.sync_student_profile_to_student_record();
