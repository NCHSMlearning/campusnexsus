-- Complete tenant registration records for student and lecturer sign-ups.
-- Existing Supabase Auth users are not recreated when a staff row is provisioned.

CREATE OR REPLACE FUNCTION public.auto_create_auth_user_from_staff_records()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth, extensions, vault
AS $$
DECLARE
  v_auth_id uuid;
  v_password_hash text;
BEGIN
  SELECT id INTO v_auth_id
  FROM auth.users
  WHERE lower(email) = lower(NEW.email)
  LIMIT 1;

  -- Registration has already created this auth account. Do not attempt to
  -- create a second account or reject the staff record.
  IF v_auth_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.password_hash IS NULL OR length(NEW.password_hash) < 8 THEN
    RAISE EXCEPTION 'A temporary password of at least 8 characters is required.';
  END IF;

  v_password_hash := crypt(NEW.password_hash, gen_salt('bf'));
  INSERT INTO auth.users (
    instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,confirmation_sent_at,
    created_at,updated_at,raw_app_meta_data,raw_user_meta_data
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',gen_random_uuid(),'authenticated','authenticated',NEW.email,
    v_password_hash,NOW(),NOW(),NOW(),NOW(),
    jsonb_build_object('provider','email','providers',ARRAY['email']),
    jsonb_build_object('full_name',concat(NEW.first_name,' ',coalesce(NEW.other_names,'')),
      'role',CASE WHEN NEW.designation IN ('Lecturer','Senior Lecturer','lecturer') THEN 'lecturer' ELSE 'staff' END,
      'staff_id',NEW.id)
  ) RETURNING id INTO v_auth_id;

  UPDATE public.staff_records
     SET password_hash=v_password_hash,password_salt=NULL,
         password_hash_algorithm='bcrypt',last_password_change=NOW()
   WHERE id=NEW.id;
  UPDATE public.consolidated_user_profiles_table SET user_id=v_auth_id WHERE email=NEW.email;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_new_auth_user_institution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth, extensions
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
  v_staff_id text;
  v_full_name text := coalesce(nullif(trim(NEW.raw_user_meta_data->>'full_name'), ''), 'New User');
  v_first_name text;
  v_other_names text;
  v_department text;
  v_phone text;
  v_gender text;
  v_program text;
BEGIN
  v_code := lower(trim(coalesce(
    NEW.raw_user_meta_data->>'school_code',
    NEW.raw_user_meta_data->>'institution_code',
    ''
  )));
  v_host := nullif(trim(coalesce(NEW.raw_user_meta_data->>'portal_host', '')), '');

  IF v_code = '' AND v_host = '' THEN
    IF v_role IN ('student', 'lecturer') THEN
      RAISE EXCEPTION 'A verified 3-digit institution school code is required for registration'
        USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  v_context := public.resolve_institution_registration_context(nullif(v_code, ''), v_host);
  v_institution_id := nullif(v_context->>'institution_id', '')::uuid;
  IF v_institution_id IS NULL THEN
    RAISE EXCEPTION 'The institution school code is invalid, inactive, or registration is closed'
      USING ERRCODE = '22023';
  END IF;

  SELECT l.id INTO v_link_id
  FROM public.institution_registration_links l
  WHERE l.institution_id = v_institution_id
    AND lower(l.code) = v_code
    AND l.is_active = true
    AND (l.expires_at IS NULL OR l.expires_at > now())
    AND (l.max_uses IS NULL OR l.use_count < l.max_uses)
  ORDER BY l.created_at DESC LIMIT 1;

  SELECT admin_email, first_admin_user_id
    INTO v_admin_email, v_claimed_user
  FROM public.institutions WHERE id = v_institution_id FOR UPDATE;

  IF v_claimed_user IS NULL AND v_admin_email IS NOT NULL
     AND lower(trim(v_admin_email)) = lower(trim(NEW.email))
     AND v_role IN ('institution_admin', 'admin') THEN
    UPDATE public.institutions
       SET first_admin_user_id = NEW.id, first_admin_claimed_at = now(), updated_at = now()
     WHERE id = v_institution_id AND first_admin_user_id IS NULL;
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
  VALUES (v_institution_id, NEW.id,
          CASE WHEN v_is_first_admin THEN 'institution_admin' ELSE v_role END,
          CASE WHEN v_is_first_admin THEN 'active' ELSE 'pending' END)
  ON CONFLICT (institution_id, user_id)
  DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status;

  IF v_role = 'student' THEN
    IF NOT EXISTS (SELECT 1 FROM public.students s WHERE s.user_id = NEW.id) THEN
      INSERT INTO public.students (
        user_id, full_name, email, phone, course, status, admission_number,
        block, intake_year, current_block, institution_id
      ) VALUES (
        NEW.id, v_full_name, NEW.email, nullif(NEW.raw_user_meta_data->>'phone',''),
        coalesce(nullif(NEW.raw_user_meta_data->>'program',''), nullif(NEW.raw_user_meta_data->>'program_type','')),
        'pending',
        coalesce(nullif(NEW.raw_user_meta_data->>'student_id',''), nullif(NEW.raw_user_meta_data->>'student_id_number','')),
        coalesce(nullif(NEW.raw_user_meta_data->>'block',''), 'Introductory'),
        nullif(NEW.raw_user_meta_data->>'intake_year',''),
        coalesce(nullif(NEW.raw_user_meta_data->>'current_block',''), 'Introductory'),
        v_institution_id
      );
    END IF;
  ELSIF v_role = 'lecturer' THEN
    v_staff_id := 'CN-LCT-' || upper(substr(replace(NEW.id::text, '-', ''), 1, 8));
    v_department := coalesce(nullif(trim(NEW.raw_user_meta_data->>'department'), ''), 'General');
    v_phone := coalesce(nullif(trim(NEW.raw_user_meta_data->>'phone'), ''), 'Not provided');
    v_program := nullif(trim(NEW.raw_user_meta_data->>'program'), '');
    v_first_name := split_part(v_full_name, ' ', 1);
    v_other_names := nullif(trim(substr(v_full_name, length(v_first_name) + 1)), '');
    v_gender := CASE lower(coalesce(NEW.raw_user_meta_data->>'gender',''))
      WHEN 'male' THEN 'M' WHEN 'm' THEN 'M'
      WHEN 'female' THEN 'F' WHEN 'f' THEN 'F' ELSE '' END;

    INSERT INTO public.lecturers (
      user_id, full_name, email, phone, department, status, approved,
      staff_id, role, institution_id
    ) VALUES (
      NEW.id, v_full_name, NEW.email, v_phone, v_department, 'pending',
      false, v_staff_id, 'lecturer', v_institution_id
    )
    ON CONFLICT (email) DO UPDATE SET
      user_id = EXCLUDED.user_id, full_name = EXCLUDED.full_name,
      phone = EXCLUDED.phone, department = EXCLUDED.department,
      status = 'pending', approved = false, staff_id = EXCLUDED.staff_id,
      role = 'lecturer', institution_id = EXCLUDED.institution_id;

    INSERT INTO public.staff_records (
      id, first_name, other_names, department, designation, email, phone,
      gender, login_enabled, status, program, institution_id
    ) VALUES (
      v_staff_id, v_first_name, v_other_names, v_department, 'lecturer',
      NEW.email, v_phone, v_gender, false, 'pending', v_program, v_institution_id
    )
    ON CONFLICT (email) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      other_names = EXCLUDED.other_names,
      department = EXCLUDED.department,
      designation = 'lecturer',
      phone = EXCLUDED.phone,
      gender = EXCLUDED.gender,
      login_enabled = false,
      status = 'pending',
      program = EXCLUDED.program,
      institution_id = EXCLUDED.institution_id;
  END IF;

  IF v_link_id IS NOT NULL THEN
    UPDATE public.institution_registration_links
       SET use_count = use_count + 1 WHERE id = v_link_id;
  END IF;

  UPDATE public.consolidated_user_profiles_table
     SET institution_id = v_institution_id,
         status = v_profile_status,
         login_enabled = v_is_first_admin,
         updated_at = now()
   WHERE user_id = NEW.id;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.auto_create_auth_user_from_staff_records() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_new_auth_user_institution() FROM PUBLIC, anon, authenticated;
