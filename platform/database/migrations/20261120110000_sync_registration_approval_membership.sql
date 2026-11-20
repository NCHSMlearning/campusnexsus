-- Keep approval state, login permission, and tenant membership synchronized.
-- Approval remains restricted to an active institution administrator or primary platform superadmin.

CREATE OR REPLACE FUNCTION private.review_institution_registration(
  p_user_id uuid,
  p_decision text,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
DECLARE
  v_profile public.consolidated_user_profiles_table%ROWTYPE;
  v_decision text := lower(trim(coalesce(p_decision, '')));
  v_reason text := left(trim(coalesce(p_reason, '')), 1000);
  v_status text;
  v_membership_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL OR v_decision NOT IN ('approve', 'reject') THEN
    RAISE EXCEPTION 'A valid user and decision are required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_profile
  FROM public.consolidated_user_profiles_table
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration application not found' USING ERRCODE = 'P0002';
  END IF;
  IF lower(coalesce(v_profile.role, '')) NOT IN ('student', 'lecturer') THEN
    RAISE EXCEPTION 'Only student and lecturer applications can be reviewed' USING ERRCODE = '22023';
  END IF;
  IF v_profile.institution_id IS NULL THEN
    RAISE EXCEPTION 'Application is not assigned to an institution' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.institutions
    WHERE id = v_profile.institution_id AND lower(coalesce(status,'')) = 'active'
  ) THEN
    RAISE EXCEPTION 'The assigned institution is not active' USING ERRCODE = '23514';
  END IF;
  IF NOT private.is_active_institution_admin(v_profile.institution_id)
     AND NOT private.is_primary_superadmin() THEN
    RAISE EXCEPTION 'You are not an active administrator of this institution' USING ERRCODE = '42501';
  END IF;
  IF lower(coalesce(v_profile.status, '')) NOT IN ('pending', 'pending_application') THEN
    RAISE EXCEPTION 'This application has already been reviewed' USING ERRCODE = '23514';
  END IF;

  v_status := CASE WHEN v_decision = 'approve' THEN 'approved' ELSE 'rejected' END;
  v_membership_status := CASE WHEN v_decision = 'approve' THEN 'active' ELSE 'suspended' END;

  UPDATE public.consolidated_user_profiles_table
  SET status = v_status,
      login_enabled = (v_decision = 'approve'),
      updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO public.institution_users(institution_id,user_id,role,status)
  VALUES(v_profile.institution_id,p_user_id,lower(v_profile.role),v_membership_status)
  ON CONFLICT(institution_id,user_id) DO UPDATE
    SET role=EXCLUDED.role,status=EXCLUDED.status;

  IF lower(v_profile.role) = 'student' THEN
    UPDATE public.students SET status = v_status WHERE user_id = p_user_id;
  ELSE
    UPDATE public.lecturers
    SET status = v_status, approved = (v_decision = 'approve')
    WHERE user_id = p_user_id;
  END IF;

  INSERT INTO public.platform_audit_logs(
    actor_user_id, institution_id, action, entity_type, entity_id, details
  ) VALUES (
    auth.uid(), v_profile.institution_id,
    CASE WHEN v_decision = 'approve' THEN 'registration_approved' ELSE 'registration_rejected' END,
    'registration_application', p_user_id,
    jsonb_build_object(
      'email', v_profile.email, 'role', v_profile.role,
      'decision', v_decision, 'reason', v_reason,
      'membership_status', v_membership_status,
      'login_enabled', (v_decision = 'approve')
    )
  );

  RETURN jsonb_build_object(
    'success', true, 'user_id', p_user_id,
    'institution_id', v_profile.institution_id, 'role', v_profile.role,
    'status', v_status, 'login_enabled', (v_decision = 'approve'),
    'membership_status', v_membership_status
  );
END;
$$;
