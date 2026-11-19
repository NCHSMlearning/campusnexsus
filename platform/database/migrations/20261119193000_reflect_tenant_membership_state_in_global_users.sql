-- Reflect tenant membership state in global user visibility and metrics.
-- A suspended membership must not appear as an active tenant account merely
-- because the shared Auth account or profile row is still enabled.

CREATE OR REPLACE FUNCTION private.platform_global_user_stats(
  p_institution_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT private.is_primary_superadmin() THEN
    RAISE EXCEPTION 'Only the Campus Nexus Platform Super Admin can view the global user directory'
      USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'total_users', count(*) FILTER (WHERE au.id IS NOT NULL),
    'linked_users', count(*) FILTER (WHERE au.id IS NOT NULL AND p.user_id IS NOT NULL),
    'missing_profiles', count(*) FILTER (WHERE au.id IS NOT NULL AND p.user_id IS NULL),
    'orphan_profiles', count(*) FILTER (WHERE au.id IS NULL AND p.user_id IS NOT NULL),
    'active_users', count(*) FILTER (
      WHERE au.id IS NOT NULL AND p.user_id IS NOT NULL
        AND lower(coalesce(p.status, '')) IN ('active','approved')
        AND coalesce(p.login_enabled, true)
        AND (au.banned_until IS NULL OR au.banned_until <= now())
        AND NOT EXISTS (
          SELECT 1 FROM public.institution_users iu
          WHERE iu.user_id = au.id
            AND (p.institution_id IS NULL OR iu.institution_id = p.institution_id)
            AND lower(coalesce(iu.status, '')) = 'suspended'
        )
    ),
    'suspended_users', count(*) FILTER (
      WHERE au.id IS NOT NULL AND p.user_id IS NOT NULL
        AND (
          lower(coalesce(p.status, '')) = 'suspended'
          OR au.banned_until > now()
          OR EXISTS (
            SELECT 1 FROM public.institution_users iu
            WHERE iu.user_id = au.id
              AND (p.institution_id IS NULL OR iu.institution_id = p.institution_id)
              AND lower(coalesce(iu.status, '')) = 'suspended'
          )
        )
    ),
    'pending_users', count(*) FILTER (
      WHERE au.id IS NOT NULL AND p.user_id IS NOT NULL
        AND (
          lower(coalesce(p.status, '')) = 'pending'
          OR EXISTS (
            SELECT 1 FROM public.institution_users iu
            WHERE iu.user_id = au.id
              AND (p.institution_id IS NULL OR iu.institution_id = p.institution_id)
              AND lower(coalesce(iu.status, '')) = 'pending'
          )
        )
    ),
    'login_disabled', count(*) FILTER (
      WHERE au.id IS NOT NULL AND p.user_id IS NOT NULL
        AND coalesce(p.login_enabled, true) = false
    ),
    'institution_admins', count(*) FILTER (
      WHERE au.id IS NOT NULL AND p.user_id IS NOT NULL
        AND (
          lower(coalesce(p.role, '')) IN ('institution_admin','admin')
          OR EXISTS (
            SELECT 1 FROM public.institution_users iu
            WHERE iu.user_id = au.id
              AND lower(coalesce(iu.role, '')) = 'institution_admin'
              AND lower(coalesce(iu.status, '')) = 'active'
          )
        )
    ),
    'lecturers', count(*) FILTER (
      WHERE au.id IS NOT NULL AND lower(coalesce(p.role, '')) = 'lecturer'
    ),
    'students', count(*) FILTER (
      WHERE au.id IS NOT NULL AND lower(coalesce(p.role, '')) = 'student'
    ),
    'platform_roles', count(*) FILTER (
      WHERE au.id IS NOT NULL AND lower(coalesce(p.role, '')) IN ('superadmin','platform_operator')
    )
  )
  INTO v_result
  FROM auth.users au
  FULL OUTER JOIN public.consolidated_user_profiles_table p
    ON p.user_id = au.id
  WHERE p_institution_id IS NULL
     OR p.institution_id = p_institution_id
     OR EXISTS (
       SELECT 1 FROM public.institution_users iu
       WHERE iu.user_id = coalesce(au.id, p.user_id)
         AND iu.institution_id = p_institution_id
     );

  RETURN coalesce(v_result, '{}'::jsonb);
END;
$function$;

CREATE OR REPLACE FUNCTION private.platform_global_user_directory(
  p_search text DEFAULT NULL,
  p_institution_id uuid DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  user_id uuid,
  profile_id uuid,
  email text,
  full_name text,
  role text,
  account_state text,
  login_enabled boolean,
  institution_id uuid,
  institution_name text,
  program text,
  department text,
  student_id text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed boolean,
  two_factor_enabled boolean,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
BEGIN
  IF NOT private.is_primary_superadmin() THEN
    RAISE EXCEPTION 'Only the Campus Nexus Platform Super Admin can view the global user directory'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH base_rows AS (
    SELECT
      coalesce(au.id, p.user_id) AS row_user_id,
      p.id AS row_profile_id,
      coalesce(au.email, p.email)::text AS row_email,
      p.full_name::text AS row_full_name,
      coalesce(
        CASE WHEN iu.institution_id = p.institution_id THEN iu.role END,
        p.role,
        'unassigned'
      )::text AS row_role,
      CASE
        WHEN p.user_id IS NULL THEN 'missing_profile'
        WHEN au.id IS NULL THEN 'missing_auth_user'
        WHEN au.banned_until > now()
          OR lower(coalesce(p.status, '')) = 'suspended'
          OR (iu.institution_id = p.institution_id AND lower(coalesce(iu.status, '')) = 'suspended')
          THEN 'suspended'
        WHEN coalesce(p.login_enabled, true) = false THEN 'login_disabled'
        WHEN lower(coalesce(p.status, '')) = 'pending'
          OR (iu.institution_id = p.institution_id AND lower(coalesce(iu.status, '')) = 'pending')
          THEN 'pending'
        ELSE lower(coalesce(p.status, 'unknown'))
      END::text AS row_state,
      p.login_enabled AS row_login_enabled,
      coalesce(p.institution_id, iu.institution_id) AS row_institution_id,
      i.name::text AS row_institution_name,
      p.program::text AS row_program,
      p.department::text AS row_department,
      p.student_id::text AS row_student_id,
      coalesce(au.created_at, p.created_at::timestamptz) AS row_created_at,
      coalesce(au.last_sign_in_at, p.last_login::timestamptz) AS row_last_sign_in_at,
      (au.email_confirmed_at IS NOT NULL) AS row_email_confirmed,
      coalesce(p.two_factor_enabled, false) AS row_two_factor_enabled
    FROM auth.users au
    FULL OUTER JOIN public.consolidated_user_profiles_table p
      ON p.user_id = au.id
    LEFT JOIN LATERAL (
      SELECT iu.institution_id, iu.role, iu.status, iu.created_at
      FROM public.institution_users iu
      WHERE iu.user_id = coalesce(au.id, p.user_id)
      ORDER BY
        CASE WHEN iu.institution_id = p.institution_id THEN 0 ELSE 1 END,
        CASE WHEN lower(coalesce(iu.status, '')) = 'active' THEN 0 ELSE 1 END,
        iu.created_at DESC
      LIMIT 1
    ) iu ON true
    LEFT JOIN public.institutions i
      ON i.id = coalesce(p.institution_id, iu.institution_id)
    WHERE p_institution_id IS NULL
       OR p.institution_id = p_institution_id
       OR iu.institution_id = p_institution_id
  ),
  filtered_rows AS (
    SELECT *
    FROM base_rows b
    WHERE (nullif(trim(coalesce(p_search, '')), '') IS NULL
      OR lower(coalesce(b.row_email, '')) LIKE '%' || lower(trim(p_search)) || '%'
      OR lower(coalesce(b.row_full_name, '')) LIKE '%' || lower(trim(p_search)) || '%'
      OR lower(coalesce(b.row_student_id, '')) LIKE '%' || lower(trim(p_search)) || '%'
      OR lower(coalesce(b.row_role, '')) LIKE '%' || lower(trim(p_search)) || '%'
      OR lower(coalesce(b.row_institution_name, '')) LIKE '%' || lower(trim(p_search)) || '%'
      OR lower(coalesce(b.row_program, '')) LIKE '%' || lower(trim(p_search)) || '%')
      AND (nullif(trim(coalesce(p_role, '')), '') IS NULL
        OR lower(b.row_role) = lower(trim(p_role)))
      AND (
        nullif(trim(coalesce(p_status, '')), '') IS NULL
        OR lower(trim(p_status)) = 'all'
        OR b.row_state = lower(trim(p_status))
      )
  )
  SELECT
    f.row_user_id,
    f.row_profile_id,
    f.row_email,
    f.row_full_name,
    f.row_role,
    f.row_state,
    f.row_login_enabled,
    f.row_institution_id,
    f.row_institution_name,
    f.row_program,
    f.row_department,
    f.row_student_id,
    f.row_created_at,
    f.row_last_sign_in_at,
    f.row_email_confirmed,
    f.row_two_factor_enabled,
    count(*) OVER () AS total_count
  FROM filtered_rows f
  ORDER BY f.row_created_at DESC NULLS LAST, f.row_email ASC
  LIMIT least(greatest(coalesce(p_limit, 50), 1), 100)
  OFFSET greatest(coalesce(p_offset, 0), 0);
END;
$function$;
