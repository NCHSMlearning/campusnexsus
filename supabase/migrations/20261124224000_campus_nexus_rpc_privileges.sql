-- Restrict SECURITY DEFINER RPC execution to authenticated sessions where the
-- function itself validates the current user, and keep trigger handlers private.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.get_exam_questions_for_staff_with_key(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_exam_questions_for_staff_with_key(integer) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_student_exam_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_student_exam_dashboard_stats() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.submit_student_exam_support_ticket(text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_student_exam_support_ticket(text,text,text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.clinical_rotation_preferences_fit_capacity(uuid,text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clinical_rotation_preferences_fit_capacity(uuid,text[]) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_clinical_rotation_capacity(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_clinical_rotation_capacity(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.handle_campus_nexus_auth_user_created() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.queue_proctoring_video_expiry() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_consolidated_user_profiles() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_institution_membership() FROM PUBLIC, anon, authenticated;

COMMIT;
