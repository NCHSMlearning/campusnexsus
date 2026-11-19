-- Add request context to administrator authentication audit events.
alter table public.admin_audit_logs
  add column if not exists ip_address text,
  add column if not exists user_agent text,
  add column if not exists device_type text,
  add column if not exists request_id text;
