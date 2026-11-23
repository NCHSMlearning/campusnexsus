-- Assignment rows created by the Institution Admin portal use the lecturer's
-- authenticated user UUID. Do not resolve via staff_records.id: lecturer self
-- registration creates the profile and institution membership independently.
CREATE OR REPLACE FUNCTION public.current_lecturer_staff_assignment_identity()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT jsonb_build_object(
    'id', p.user_id,
    'program', CASE
      WHEN upper(trim(coalesce(p.program, ''))) IN ('KRCHN', 'CPOTT', 'CCA', 'DICT')
        THEN upper(trim(p.program))
      ELSE NULL
    END,
    'department', p.department
  )
  FROM public.consolidated_user_profiles_table AS p
  JOIN public.institution_users AS iu
    ON iu.institution_id = p.institution_id
   AND iu.user_id = p.user_id
   AND lower(trim(coalesce(iu.status, ''))) = 'active'
  JOIN public.institutions AS i
    ON i.id = p.institution_id
   AND lower(trim(coalesce(i.status, ''))) = 'active'
  WHERE p.user_id = auth.uid()
    AND lower(trim(coalesce(p.role, ''))) = 'lecturer'
    AND lower(trim(coalesce(p.status, ''))) IN ('active', 'approved')
    AND coalesce(p.login_enabled, true) = true
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_lecturer_staff_assignment_identity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_lecturer_staff_assignment_identity() TO authenticated;

-- RLS uses the same identity contract as the assignment writer.
DROP POLICY IF EXISTS lecturers_read_own_subject_assignments
ON public.lecturer_subject_assignments;

CREATE POLICY lecturers_read_own_subject_assignments
ON public.lecturer_subject_assignments
FOR SELECT
TO authenticated
USING (
  lecturer_id = (
    public.current_lecturer_staff_assignment_identity() ->> 'id'
  )
);
