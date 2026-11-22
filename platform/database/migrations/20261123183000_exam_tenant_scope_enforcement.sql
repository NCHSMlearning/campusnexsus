CREATE OR REPLACE FUNCTION private.enforce_exam_student_institution_scope()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $function$
DECLARE
  v_row jsonb;
  v_student_id uuid;
  v_exam_id integer;
  v_student_institution uuid;
  v_exam_institution uuid;
  v_row_institution uuid;
BEGIN
  v_row := to_jsonb(NEW);
  v_student_id := nullif(v_row->>'student_id', '')::uuid;
  v_exam_id := nullif(v_row->>'exam_id', '')::integer;

  IF v_student_id IS NULL OR v_exam_id IS NULL THEN
    RAISE EXCEPTION 'A valid student and examination are required for exam records.'
      USING ERRCODE = '42501';
  END IF;

  SELECT p.institution_id
    INTO v_student_institution
    FROM public.consolidated_user_profiles_table p
   WHERE p.user_id = v_student_id
   LIMIT 1;

  SELECT e.institution_id
    INTO v_exam_institution
    FROM public.exams e
   WHERE e.id = v_exam_id
   LIMIT 1;

  IF v_student_institution IS NULL OR v_exam_institution IS NULL
     OR v_student_institution IS DISTINCT FROM v_exam_institution THEN
    RAISE EXCEPTION 'This student and examination do not belong to the same institution. Exam record rejected.'
      USING ERRCODE = '42501';
  END IF;

  IF TG_TABLE_NAME IN ('exam_attempts', 'exam_proctoring_logs') THEN
    v_row_institution := nullif(v_row->>'institution_id', '')::uuid;
    IF v_row_institution IS NOT NULL
       AND v_row_institution IS DISTINCT FROM v_exam_institution THEN
      RAISE EXCEPTION 'The exam record institution does not match the examination institution.'
        USING ERRCODE = '42501';
    END IF;

    NEW := jsonb_populate_record(NEW, jsonb_build_object('institution_id', v_exam_institution));
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION private.enforce_exam_student_institution_scope() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_exam_tenant_scope_attempts ON public.exam_attempts;
CREATE TRIGGER trg_exam_tenant_scope_attempts
BEFORE INSERT OR UPDATE ON public.exam_attempts
FOR EACH ROW EXECUTE FUNCTION private.enforce_exam_student_institution_scope();

DROP TRIGGER IF EXISTS trg_exam_tenant_scope_grades ON public.exam_grades;
CREATE TRIGGER trg_exam_tenant_scope_grades
BEFORE INSERT OR UPDATE ON public.exam_grades
FOR EACH ROW EXECUTE FUNCTION private.enforce_exam_student_institution_scope();

DROP TRIGGER IF EXISTS trg_exam_tenant_scope_answers ON public.exam_answers;
CREATE TRIGGER trg_exam_tenant_scope_answers
BEFORE INSERT OR UPDATE ON public.exam_answers
FOR EACH ROW EXECUTE FUNCTION private.enforce_exam_student_institution_scope();

DROP TRIGGER IF EXISTS trg_exam_tenant_scope_attendance ON public.exam_attendance;
CREATE TRIGGER trg_exam_tenant_scope_attendance
BEFORE INSERT OR UPDATE ON public.exam_attendance
FOR EACH ROW EXECUTE FUNCTION private.enforce_exam_student_institution_scope();

DROP TRIGGER IF EXISTS trg_exam_tenant_scope_heartbeats ON public.exam_heartbeats;
CREATE TRIGGER trg_exam_tenant_scope_heartbeats
BEFORE INSERT OR UPDATE ON public.exam_heartbeats
FOR EACH ROW EXECUTE FUNCTION private.enforce_exam_student_institution_scope();

DROP TRIGGER IF EXISTS trg_exam_tenant_scope_live_sessions ON public.live_exam_sessions;
CREATE TRIGGER trg_exam_tenant_scope_live_sessions
BEFORE INSERT OR UPDATE ON public.live_exam_sessions
FOR EACH ROW EXECUTE FUNCTION private.enforce_exam_student_institution_scope();

DROP TRIGGER IF EXISTS trg_exam_tenant_scope_proctoring_logs ON public.exam_proctoring_logs;
CREATE TRIGGER trg_exam_tenant_scope_proctoring_logs
BEFORE INSERT OR UPDATE ON public.exam_proctoring_logs
FOR EACH ROW EXECUTE FUNCTION private.enforce_exam_student_institution_scope();
