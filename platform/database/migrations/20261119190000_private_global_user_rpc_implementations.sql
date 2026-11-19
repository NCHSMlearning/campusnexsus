-- Keep the privileged implementation in the non-exposed private schema.
-- Public RPC wrappers are SECURITY INVOKER and delegate to explicitly guarded
-- private SECURITY DEFINER implementations.

ALTER FUNCTION public.platform_global_user_stats(uuid) SET SCHEMA private;
ALTER FUNCTION public.platform_global_user_directory(text, uuid, text, text, integer, integer) SET SCHEMA private;

GRANT USAGE ON SCHEMA private TO authenticated;
REVOKE ALL ON FUNCTION private.platform_global_user_stats(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.platform_global_user_directory(text, uuid, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.platform_global_user_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.platform_global_user_directory(text, uuid, text, text, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.platform_global_user_stats(
  p_institution_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  SELECT private.platform_global_user_stats(p_institution_id);
$function$;

CREATE OR REPLACE FUNCTION public.platform_global_user_directory(
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
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth'
AS $function$
  SELECT *
  FROM private.platform_global_user_directory(
    p_search, p_institution_id, p_role, p_status, p_limit, p_offset
  );
$function$;

REVOKE ALL ON FUNCTION public.platform_global_user_stats(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.platform_global_user_directory(text, uuid, text, text, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.platform_global_user_stats(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.platform_global_user_directory(text, uuid, text, text, integer, integer) TO authenticated;
