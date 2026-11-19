-- CampusNexus production hardening: remove table-maintenance privileges
-- from browser roles while preserving the CRUD operations used by the CMS.
-- Default privileges are managed by the database object owners and are
-- intentionally not altered by this migration.

begin;

do $$
declare
  t record;
begin
  for t in
    select schemaname, tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format(
      'revoke truncate, references, trigger, maintain on table %I.%I from anon, authenticated',
      t.schemaname,
      t.tablename
    );
  end loop;
end
$$;

-- Pin the SECURITY DEFINER helper to an empty search_path and qualify every object.
-- It remains executable only by signed-in users because RLS policies call it.
create or replace function private.is_cms_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.cms_admins
    where user_id = (select auth.uid())
      and role in ('admin', 'editor')
  );
$function$;

revoke all on function private.is_cms_admin() from public, anon;
grant execute on function private.is_cms_admin() to authenticated;

commit;