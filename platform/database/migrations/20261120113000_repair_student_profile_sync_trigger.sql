-- Repair student-to-profile synchronization for tenant student records.
-- Use a namespaced custom GUC (Postgres rejects bare custom parameter names).
-- Keep the profile role separate from the student lifecycle status.

CREATE OR REPLACE FUNCTION public.sync_consolidated_user_profiles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
DECLARE
  v_status text := lower(trim(coalesce(NEW.status, 'pending')));
  v_login_enabled boolean;
BEGIN
  IF current_setting('app.is_consolidated_sync', true) = 't' THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('app.is_consolidated_sync', 't', true);
  v_login_enabled := v_status IN ('approved', 'active');

  INSERT INTO public.consolidated_user_profiles_table (
    id, user_id, full_name, email, phone, role, program, status,
    intake_year, block, block_program_year, created_at,
    institution_id, login_enabled, student_id
  )
  VALUES (
    gen_random_uuid(), NEW.user_id, NEW.full_name, NEW.email, NEW.phone,
    'student', NEW.course, v_status, NEW.intake_year, NEW.block,
    coalesce(NEW.block_program_year, false), coalesce(NEW.created_at, now()),
    NEW.institution_id, v_login_enabled, NEW.admission_number
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = coalesce(EXCLUDED.full_name, consolidated_user_profiles_table.full_name),
    email = coalesce(EXCLUDED.email, consolidated_user_profiles_table.email),
    phone = coalesce(EXCLUDED.phone, consolidated_user_profiles_table.phone),
    role = 'student',
    program = coalesce(EXCLUDED.program, consolidated_user_profiles_table.program),
    status = EXCLUDED.status,
    intake_year = coalesce(EXCLUDED.intake_year, consolidated_user_profiles_table.intake_year),
    block = coalesce(EXCLUDED.block, consolidated_user_profiles_table.block),
    block_program_year = coalesce(EXCLUDED.block_program_year, consolidated_user_profiles_table.block_program_year),
    institution_id = coalesce(EXCLUDED.institution_id, consolidated_user_profiles_table.institution_id),
    login_enabled = EXCLUDED.login_enabled,
    student_id = coalesce(nullif(EXCLUDED.student_id, ''), consolidated_user_profiles_table.student_id),
    updated_at = now();

  RETURN NEW;
END;
$$;

-- Two duplicate triggers previously invoked the same sync function twice.
DROP TRIGGER IF EXISTS trg_sync_consolidated_user_profiles ON public.students;
