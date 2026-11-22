-- Persistent delivery history for Campus Nexus transactional emails.
-- Edge Functions use the service role; browser clients cannot read or modify these records.
create table if not exists public.notification_delivery_logs (
  id uuid primary key default gen_random_uuid(),
  institution_id uuid,
  recipient_user_id uuid,
  recipient_email text not null,
  notification_type text not null,
  entity_type text not null,
  entity_id text not null,
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending','accepted','failed','skipped')),
  provider text not null default 'brevo',
  provider_message_id text,
  error_message text,
  attempted_at timestamptz not null default now(),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_delivery_logs_dedupe
    unique (notification_type, entity_type, entity_id, recipient_user_id)
);
create index if not exists idx_notification_delivery_logs_institution
  on public.notification_delivery_logs(institution_id, created_at desc);
create index if not exists idx_notification_delivery_logs_entity
  on public.notification_delivery_logs(entity_type, entity_id);
create index if not exists idx_notification_delivery_logs_status
  on public.notification_delivery_logs(delivery_status, created_at desc);
alter table public.notification_delivery_logs enable row level security;
revoke all on public.notification_delivery_logs from anon, authenticated;
grant all on public.notification_delivery_logs to service_role;
