-- Campus Nexus Global User Management: institution-scoped account controls.
-- These controls modify only one institution membership. They do not ban or
-- disable the user's global Supabase Auth account.

CREATE OR REPLACE FUNCTION private.platform_manage_institution_user(
  p_user_id uuid,
  p_institution_id uuid,
  p_action text,
  p_value text,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_old_role text;
  v_old_status text;
  v_new_role text;
  v_new_status text;
  v_profile_role text;
  v_profile_institution uuid;
  v_admin_count integer;
  v_action text := lower(trim(coalesce(p_action, '')));
  v_value text := lower(trim(coalesce(p_value, '')));
BEGIN
  IF auth.uid() IS NULL OR NOT private.is_primary_superadmin() THEN
    RAISE EXCEPTION 'Only the primary Campus Nexus Platform Super Admin can manage institution memberships'
      USING ERRCODE = '42501';
  END IF;

  IF p_user_id IS NULL OR p_institution_id IS NULL THEN
    RAISE EXCEPTION 'A user and institution are required' USING ERRCODE = '22023';
  END IF;

  -- Serialize admin-count checks and membership changes for this institution.
  PERFORM 1 FROM public.institutions WHERE id = p_institution_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Institution not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT iu.role, iu.status
    INTO v_old_role, v_old_status
  FROM public.institution_users iu
  WHERE iu.user_id = p_user_id
    AND iu.institution_id = p_institution_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This user has no membership in the selected institution'
      USING ERRCODE = 'P0002';
  END IF;

  SELECT p.role, p.institution_id
    INTO v_profile_role, v_profile_institution
  FROM public.consolidated_user_profiles_table p
  WHERE p.user_id = p_user_id
  LIMIT 1;

  IF lower(coalesce(v_old_role, '')) IN ('superadmin', 'platform_operator')
     OR lower(coalesce(v_profile_role, '')) IN ('superadmin', 'platform_operator') THEN
    RAISE EXCEPTION 'Platform-level accounts cannot be changed through institution membership controls'
      USING ERRCODE = '42501';
  END IF;

  IF v_action = 'set_status' THEN
    IF v_value NOT IN ('active', 'suspended') THEN
      RAISE EXCEPTION 'Membership status must be active or suspended'
        USING ERRCODE = '22023';
    END IF;
    v_new_status := v_value;
    v_new_role := v_old_role;

    IF v_old_status = 'active'
       AND v_new_status = 'suspended'
       AND lower(coalesce(v_old_role, '')) = 'institution_admin' THEN
      SELECT count(*) INTO v_admin_count
      FROM public.institution_users iu
      WHERE iu.institution_id = p_institution_id
        AND lower(iu.role) = 'institution_admin'
        AND lower(iu.status) = 'active'
        AND iu.user_id <> p_user_id;
      IF v_admin_count < 1 THEN
        RAISE EXCEPTION 'The last active institution administrator cannot be suspended'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    UPDATE public.institution_users
      SET status = v_new_status
    WHERE user_id = p_user_id AND institution_id = p_institution_id;

    IF v_profile_institution = p_institution_id THEN
      UPDATE public.consolidated_user_profiles_table
        SET status = v_new_status, updated_at = now()
      WHERE user_id = p_user_id AND institution_id = p_institution_id;
    END IF;

  ELSIF v_action = 'set_role' THEN
    IF v_value NOT IN (
      'student', 'lecturer', 'institution_admin',
      'finance_officer', 'director', 'applicant'
    ) THEN
      RAISE EXCEPTION 'This role is not available for institution assignment'
        USING ERRCODE = '22023';
    END IF;
    v_new_role := v_value;
    v_new_status := v_old_status;

    IF lower(coalesce(v_old_role, '')) = 'institution_admin'
       AND v_new_role <> 'institution_admin'
       AND lower(coalesce(v_old_status, '')) = 'active' THEN
      SELECT count(*) INTO v_admin_count
      FROM public.institution_users iu
      WHERE iu.institution_id = p_institution_id
        AND lower(iu.role) = 'institution_admin'
        AND lower(iu.status) = 'active'
        AND iu.user_id <> p_user_id;
      IF v_admin_count < 1 THEN
        RAISE EXCEPTION 'The last active institution administrator cannot be demoted'
          USING ERRCODE = '23514';
      END IF;
    END IF;

    UPDATE public.institution_users
      SET role = v_new_role
    WHERE user_id = p_user_id AND institution_id = p_institution_id;

    IF v_profile_institution = p_institution_id THEN
      UPDATE public.consolidated_user_profiles_table
        SET role = v_new_role, updated_at = now()
      WHERE user_id = p_user_id AND institution_id = p_institution_id;
    END IF;

  ELSE
    RAISE EXCEPTION 'Unsupported account management action'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.platform_audit_logs (
    actor_user_id, institution_id, action, entity_type, entity_id, details
  )
  VALUES (
    auth.uid(),
    p_institution_id,
    CASE WHEN v_action = 'set_status'
      THEN 'institution_user_status_changed'
      ELSE 'institution_user_role_changed'
    END,
    'institution_user',
    p_user_id,
    jsonb_build_object(
      'target_user_id', p_user_id,
      'old_role', v_old_role,
      'new_role', v_new_role,
      'old_status', v_old_status,
      'new_status', v_new_status,
      'action', v_action,
      'context', coalesce(p_context, '{}'::jsonb)
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_id', p_user_id,
    'institution_id', p_institution_id,
    'role', v_new_role,
    'status', v_new_status,
    'message', 'Institution membership updated successfully'
  );
END;
$function$;

REVOKE ALL ON FUNCTION private.platform_manage_institution_user(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.platform_manage_institution_user(uuid, uuid, text, text, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_manage_institution_user(
  p_user_id uuid,
  p_institution_id uuid,
  p_action text,
  p_value text,
  p_context jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE sql
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  SELECT private.platform_manage_institution_user(
    p_user_id, p_institution_id, p_action, p_value, p_context
  );
$function$;

REVOKE ALL ON FUNCTION public.platform_manage_institution_user(uuid, uuid, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_manage_institution_user(uuid, uuid, text, text, jsonb) TO authenticated;
