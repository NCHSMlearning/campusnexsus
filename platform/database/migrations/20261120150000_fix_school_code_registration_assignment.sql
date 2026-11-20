-- Campus Nexus: bind self-service registrations to the institution's public 3-digit school code.
-- Registration-link tokens remain supported for older institution-specific links.

CREATE OR REPLACE FUNCTION public.assign_new_auth_user_institution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
DECLARE
  v_code text;
  v_host text;
  v_context jsonb;
  v_institution_id uuid;
  v_link_id uuid;
  v_admin_email text;
  v_claimed_user uuid;
  v_is_first_admin boolean := false;
  v_role text := lower(trim(coalesce(NEW.raw_user_meta_data->>'role', 'student')));
  v_profile_status text;
BEGIN
  v_code := lower(trim(coalesce(
    NEW.raw_user_meta_data->>'school_code',
    NEW.raw_user_meta_data->>'institution_code',
    ''
  )));
  v_host := nullif(trim(coalesce(NEW.raw_user_meta_data->>'portal_host', '')), '');

  -- Keep unrelated platform account creation working, but require institution
  -- context for self-service student and lecturer registrations.
  IF v_code = '' AND v_host = '' THEN
    IF v_role IN ('student', 'lecturer') THEN
      RAISE EXCEPTION 'A verified 3-digit institution school code is required for registration'
        USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  v_context := public.resolve_institution_registration_context(
    nullif(v_code, ''),
    v_host
  );

  v_institution_id := nullif(v_context->>'institution_id', '')::uuid;
  IF v_institution_id IS NULL THEN
    RAISE EXCEPTION 'The institution school code is invalid, inactive, or registration is closed'
      USING ERRCODE = '22023';
  END IF;

  -- Preserve usage tracking for legacy secret registration-link tokens.
  SELECT l.id INTO v_link_id
  FROM public.institution_registration_links l
  WHERE l.institution_id = v_institution_id
    AND lower(l.code) = v_code
    AND l.is_active = true
    AND (l.expires_at IS NULL OR l.expires_at > now())
    AND (l.max_uses IS NULL OR l.use_count < l.max_uses)
  ORDER BY l.created_at DESC
  LIMIT 1;

  SELECT admin_email, first_admin_user_id
    INTO v_admin_email, v_claimed_user
  FROM public.institutions
  WHERE id = v_institution_id
  FOR UPDATE;

  -- Only the configured admin email can claim the first institution-admin seat.
  IF v_claimed_user IS NULL
     AND v_admin_email IS NOT NULL
     AND lower(trim(v_admin_email)) = lower(trim(NEW.email))
     AND v_role IN ('institution_admin', 'admin') THEN
    UPDATE public.institutions
       SET first_admin_user_id = NEW.id,
           first_admin_claimed_at = now(),
           updated_at = now()
     WHERE id = v_institution_id
       AND first_admin_user_id IS NULL;
    v_is_first_admin := FOUND;
  END IF;

  v_profile_status := CASE WHEN v_is_first_admin THEN 'active' ELSE 'pending' END;

  UPDATE public.consolidated_user_profiles_table
     SET institution_id = v_institution_id,
         role = CASE WHEN v_is_first_admin THEN 'admin' ELSE role END,
         status = v_profile_status,
         login_enabled = v_is_first_admin,
         updated_at = now()
   WHERE user_id = NEW.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Registration profile could not be linked to the selected institution'
      USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.institution_users(institution_id, user_id, role, status)
  VALUES (
    v_institution_id,
    NEW.id,
    CASE WHEN v_is_first_admin THEN 'institution_admin' ELSE v_role END,
    CASE WHEN v_is_first_admin THEN 'active' ELSE 'pending' END
  )
  ON CONFLICT (institution_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

  IF v_link_id IS NOT NULL THEN
    UPDATE public.institution_registration_links
       SET use_count = use_count + 1
     WHERE id = v_link_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_new_auth_user_institution() FROM PUBLIC, anon, authenticated;
