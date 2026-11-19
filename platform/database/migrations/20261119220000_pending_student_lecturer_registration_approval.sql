-- Enforce pending institution approval for self-registered student and lecturer accounts.
-- Users cannot promote their own profile or enable their own login while pending.

CREATE OR REPLACE FUNCTION private.enforce_pending_institution_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF lower(coalesce(NEW.role, '')) IN ('student', 'lecturer') THEN
      NEW.status := 'pending';
      NEW.login_enabled := false;
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id
     AND lower(coalesce(OLD.role, '')) IN ('student', 'lecturer') THEN
    NEW.role := OLD.role;
    IF lower(coalesce(OLD.status, '')) NOT IN ('approved', 'active') THEN
      NEW.status := 'pending';
      NEW.login_enabled := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_pending_institution_registration
  ON public.consolidated_user_profiles_table;
CREATE TRIGGER trg_enforce_pending_institution_registration
BEFORE INSERT OR UPDATE ON public.consolidated_user_profiles_table
FOR EACH ROW EXECUTE FUNCTION private.enforce_pending_institution_registration();

REVOKE ALL ON FUNCTION private.enforce_pending_institution_registration() FROM PUBLIC, anon, authenticated;

-- Institution administrators approve/reject applications only inside their own institution.
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

  UPDATE public.institution_users
  SET status = v_membership_status
  WHERE institution_id = v_profile.institution_id
    AND user_id = p_user_id;

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
      'decision', v_decision, 'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'success', true, 'user_id', p_user_id,
    'institution_id', v_profile.institution_id, 'role', v_profile.role,
    'status', v_status, 'login_enabled', (v_decision = 'approve')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.review_institution_registration(
  p_user_id uuid, p_decision text, p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
  SELECT private.review_institution_registration(p_user_id, p_decision, p_reason);
$$;

REVOKE ALL ON FUNCTION private.review_institution_registration(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION private.review_institution_registration(uuid, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.review_institution_registration(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_institution_registration(uuid, text, text) TO authenticated;
