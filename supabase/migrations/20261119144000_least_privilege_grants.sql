-- Restrict browser-role table privileges to the operations used by the
-- CampusNexus public CMS and authenticated administrator dashboard.
begin;

revoke all on table
  public.admin_audit_logs,
  public.chat_agents,
  public.chat_messages,
  public.chat_sessions,
  public.cms_admins,
  public.cms_site_content,
  public.cms_site_revisions,
  public.consultation_bookings,
  public.users,
  public.visitor_events,
  public.visitor_page_views,
  public.visitor_sessions
from anon, authenticated;

grant select on table public.cms_site_content to anon, authenticated;
grant insert, update on table public.cms_site_content to authenticated;
grant select on table public.cms_admins, public.users to authenticated;
grant select on table
  public.admin_audit_logs,
  public.visitor_events,
  public.visitor_page_views,
  public.visitor_sessions
to authenticated;
grant select, insert, update on table public.chat_messages to authenticated;
grant select, update on table public.chat_sessions to authenticated;
grant select, insert on table public.cms_site_revisions to authenticated;
grant select, update on table public.consultation_bookings to authenticated;

-- chat_agents is a legacy table with a password column and is not used by
-- the current dashboard; browser roles receive no direct access to it.
commit;
