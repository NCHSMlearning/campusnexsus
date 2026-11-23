-- Avoid querying protected staff_records from the lecturer assignment RLS policy.
-- The secure self-identity RPC returns only the caller's own staff assignment ID.
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
