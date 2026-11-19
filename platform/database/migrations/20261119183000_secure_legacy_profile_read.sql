-- Remove the legacy director-wide read path from the non-tenant profile table.
-- This table contains a legacy password field and has no institution_id column.
DROP POLICY IF EXISTS director_read_all ON public.consolidated_user_profiles;

-- Keep only the columns required by the authenticated self-profile fallback.
-- In particular, do not expose the legacy password column through the Data API.
REVOKE SELECT ON TABLE public.consolidated_user_profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT (
  id, user_id, full_name, email, phone, created_at, role, role_id,
  department, status, intake_year, block, block_program_year, program, student_id
) ON TABLE public.consolidated_user_profiles TO authenticated;
