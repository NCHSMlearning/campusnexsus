-- Allow a lecturer to resolve only their own staff_records identity.
-- staff_records is otherwise gated by the Human Resources module entitlement.
-- The dashboard needs the staff_records.id because lecturer_subject_assignments.lecturer_id
-- references that identifier. This SECURITY DEFINER RPC returns only the caller's
-- own minimal assignment identity and requires an active institution membership.

CREATE OR REPLACE FUNCTION public.current_lecturer_staff_assignment_identity()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
  SELECT jsonb_build_object(
    'id', sr.id,
    'program', sr.program,
    'department', sr.department
  )
  FROM public.staff_records AS sr
  JOIN public.institution_users AS iu
    ON iu.institution_id = sr.institution_id
   AND iu.user_id = auth.uid()
   AND lower(trim(coalesce(iu.status, ''))) = 'active'
  JOIN public.institutions AS i
    ON i.id = sr.institution_id
   AND lower(trim(coalesce(i.status, ''))) = 'active'
  WHERE auth.uid() IS NOT NULL
    AND lower(trim(coalesce(sr.email, ''))) = lower(trim(coalesce(auth.jwt() ->> 'email', '')))
    AND lower(trim(coalesce(sr.designation, ''))) IN ('lecturer', 'senior lecturer')
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_lecturer_staff_assignment_identity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_lecturer_staff_assignment_identity() TO authenticated;
