-- Campus Nexus institution school codes and pending registration approval
-- New school codes are public institution identifiers; registration link tokens remain separate.

ALTER TABLE public.institutions
  ADD COLUMN IF NOT EXISTS school_code text;

CREATE OR REPLACE FUNCTION private.generate_institution_school_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_code text;
BEGIN
  LOOP
    v_code := lpad(floor(random() * 1000000000000)::bigint::text, 12, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.institutions i WHERE i.school_code = v_code
    );
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION private.assign_institution_school_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $$
BEGIN
  IF NEW.school_code IS NULL OR btrim(NEW.school_code) = '' THEN
    NEW.school_code := private.generate_institution_school_code();
  ELSE
    NEW.school_code := regexp_replace(NEW.school_code, '[[:space:]-]+', '', 'g');
  END IF;

  IF NEW.school_code !~ '^[0-9]{12}$' THEN
    RAISE EXCEPTION 'School code must contain exactly 12 digits'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  v_id uuid;
BEGIN
  FOR v_id IN
    SELECT id FROM public.institutions WHERE school_code IS NULL OR btrim(school_code) = ''
  LOOP
    UPDATE public.institutions
       SET school_code = private.generate_institution_school_code()
     WHERE id = v_id;
  END LOOP;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_institution_school_code ON public.institutions;
CREATE TRIGGER trg_assign_institution_school_code
BEFORE INSERT OR UPDATE OF school_code ON public.institutions
FOR EACH ROW
EXECUTE FUNCTION private.assign_institution_school_code();

ALTER TABLE public.institutions
  ALTER COLUMN school_code SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'institutions_school_code_format_check'
      AND conrelid = 'public.institutions'::regclass
  ) THEN
    ALTER TABLE public.institutions
      ADD CONSTRAINT institutions_school_code_format_check
      CHECK (school_code ~ '^[0-9]{12}$');
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS institutions_school_code_uidx
  ON public.institutions (school_code);

CREATE OR REPLACE FUNCTION public.resolve_institution_registration_context(
  p_code text DEFAULT NULL,
  p_host text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
DECLARE
  v_code text := regexp_replace(lower(trim(coalesce(p_code, ''))), '[[:space:]-]+', '', 'g');
  v_host text := lower(regexp_replace(
    regexp_replace(split_part(trim(coalesce(p_host, '')), ':', 1), '^https?://', '', 'i'),
    '/+$', '', 'g'
  ));
  v_result jsonb;
BEGIN
  IF v_code = '' AND v_host <> '' THEN
    SELECT l.code
      INTO v_code
      FROM public.institutions i
      JOIN public.institution_registration_links l ON l.institution_id = i.id
     WHERE lower(regexp_replace(regexp_replace(trim(coalesce(i.portal_domain, '')), '^https?://', '', 'i'), '/+$', '', 'g')) = v_host
       AND i.status = 'active'
       AND l.is_active = true
       AND (l.expires_at IS NULL OR l.expires_at > now())
       AND (l.max_uses IS NULL OR l.use_count < l.max_uses)
     ORDER BY l.created_at DESC
     LIMIT 1;
    v_code := regexp_replace(lower(trim(coalesce(v_code, ''))), '[[:space:]-]+', '', 'g');
  END IF;

  IF v_code = '' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'institution_id', i.id,
    'institution_name', i.name,
    'short_code', i.short_code,
    'school_code', i.school_code,
    'logo_url', i.logo_url,
    'brand_colors', i.brand_colors,
    'primary_color', i.primary_color,
    'secondary_color', i.secondary_color
  )
  INTO v_result
  FROM public.institutions i
  JOIN LATERAL (
    SELECT l.id
      FROM public.institution_registration_links l
     WHERE l.institution_id = i.id
       AND l.is_active = true
       AND (l.expires_at IS NULL OR l.expires_at > now())
       AND (l.max_uses IS NULL OR l.use_count < l.max_uses)
     ORDER BY l.created_at DESC
     LIMIT 1
  ) active_link ON true
  WHERE i.status = 'active'
    AND (
      regexp_replace(lower(i.school_code), '[[:space:]-]+', '', 'g') = v_code
      OR EXISTS (
        SELECT 1
          FROM public.institution_registration_links match_link
         WHERE match_link.institution_id = i.id
           AND match_link.is_active = true
           AND regexp_replace(lower(match_link.code), '[[:space:]-]+', '', 'g') = v_code
           AND (match_link.expires_at IS NULL OR match_link.expires_at > now())
           AND (match_link.max_uses IS NULL OR match_link.use_count < match_link.max_uses)
      )
    )
  LIMIT 1;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_institution_registration_context(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_institution_registration_context(text, text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.assign_new_auth_user_institution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth, extensions, vault
AS $$
DECLARE
  v_code text;
  v_institution_id uuid;
  v_link_id uuid;
  v_admin_email text;
  v_claimed_user uuid;
  v_is_first_admin boolean := false;
  v_role text := lower(trim(coalesce(NEW.raw_user_meta_data->>'role', 'student')));
BEGIN
  v_code := regexp_replace(
    lower(trim(coalesce(
      NEW.raw_user_meta_data->>'school_code',
      NEW.raw_user_meta_data->>'institution_code',
      ''
    ))),
    '[[:space:]-]+', '', 'g'
  );

  IF v_code = '' AND nullif(trim(NEW.raw_user_meta_data->>'portal_host'), '') IS NOT NULL THEN
    v_code := public.resolve_institution_registration_code(NEW.raw_user_meta_data->>'portal_host');
    v_code := regexp_replace(lower(trim(coalesce(v_code, ''))), '[[:space:]-]+', '', 'g');
  END IF;

  IF v_role IN ('student', 'lecturer', 'admin', 'institution_admin') AND v_code = '' THEN
    RAISE EXCEPTION 'A valid institution school code is required for this registration'
      USING ERRCODE = '22023';
  END IF;

  IF v_code <> '' AND v_role NOT IN ('student', 'lecturer', 'admin', 'institution_admin') THEN
    RAISE EXCEPTION 'This role cannot be self-registered through an institution link'
      USING ERRCODE = '42501';
  END IF;

  SELECT l.id, l.institution_id
    INTO v_link_id, v_institution_id
    FROM public.institution_registration_links l
    JOIN public.institutions i ON i.id = l.institution_id
   WHERE (
      regexp_replace(lower(l.code), '[[:space:]-]+', '', 'g') = v_code
      OR regexp_replace(lower(i.school_code), '[[:space:]-]+', '', 'g') = v_code
   )
     AND l.is_active = true
     AND (l.expires_at IS NULL OR l.expires_at > now())
     AND (l.max_uses IS NULL OR l.use_count < l.max_uses)
     AND i.status = 'active'
   ORDER BY l.created_at DESC
   LIMIT 1;

  IF v_institution_id IS NULL THEN
    IF v_code <> '' THEN
      RAISE EXCEPTION 'The school code is invalid, expired, or registration is closed'
        USING ERRCODE = '22023';
    END IF;
    RETURN NEW;
  END IF;

  SELECT admin_email, first_admin_user_id
    INTO v_admin_email, v_claimed_user
    FROM public.institutions
   WHERE id = v_institution_id
   FOR UPDATE;

  IF v_role IN ('admin', 'institution_admin') THEN
    IF v_admin_email IS NULL
       OR lower(trim(v_admin_email)) <> lower(trim(NEW.email))
       OR v_claimed_user IS NOT NULL THEN
      RAISE EXCEPTION 'This email is not the unclaimed first administrator for this institution'
        USING ERRCODE = '42501';
    END IF;

    UPDATE public.institutions
       SET first_admin_user_id = NEW.id,
           first_admin_claimed_at = now(),
           updated_at = now()
     WHERE id = v_institution_id
       AND first_admin_user_id IS NULL
       AND lower(trim(admin_email)) = lower(trim(NEW.email));
    v_is_first_admin := FOUND;

    IF NOT v_is_first_admin THEN
      RAISE EXCEPTION 'The first administrator invitation has already been claimed'
        USING ERRCODE = '23505';
    END IF;
  ELSIF v_role NOT IN ('student', 'lecturer') THEN
    RAISE EXCEPTION 'Only student and lecturer registrations are accepted through this link'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.consolidated_user_profiles_table
     SET institution_id = v_institution_id,
         role = CASE WHEN v_is_first_admin THEN 'admin' ELSE v_role END,
         status = CASE WHEN v_is_first_admin THEN 'active' ELSE 'pending' END,
         login_enabled = true,
         updated_at = now()
   WHERE user_id = NEW.id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The user profile could not be provisioned'
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

  UPDATE public.institution_registration_links
     SET use_count = use_count + 1
   WHERE id = v_link_id;

  RETURN NEW;
END;
$$;

DROP POLICY IF EXISTS institution_admin_read_own_institution_profiles
  ON public.consolidated_user_profiles_table;

CREATE POLICY institution_admin_read_own_institution_profiles
  ON public.consolidated_user_profiles_table
  FOR SELECT
  TO authenticated
  USING (private.has_active_institution_admin_access(institution_id));

REVOKE ALL ON FUNCTION private.generate_institution_school_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.assign_institution_school_code() FROM PUBLIC, anon, authenticated;
