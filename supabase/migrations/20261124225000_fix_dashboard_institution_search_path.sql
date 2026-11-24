-- Pin the dashboard institution trigger to a safe, deterministic search path.
ALTER FUNCTION public.cn_assign_dashboard_institution()
  SET search_path TO pg_catalog, public, private, auth;
