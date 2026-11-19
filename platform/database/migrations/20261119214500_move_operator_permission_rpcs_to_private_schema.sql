alter function public.platform_operator_user_search(text) set schema private;
alter function public.platform_operator_permissions_directory() set schema private;
alter function public.platform_manage_operator_permission(uuid,text,uuid,text,text) set schema private;

create or replace function public.platform_operator_user_search(p_search text default null)
returns jsonb language sql stable security invoker
set search_path=pg_catalog,private
as $$ select private.platform_operator_user_search(p_search); $$;
create or replace function public.platform_operator_permissions_directory()
returns jsonb language sql stable security invoker
set search_path=pg_catalog,private
as $$ select private.platform_operator_permissions_directory(); $$;
create or replace function public.platform_manage_operator_permission(
 p_user_id uuid,p_permission_key text,p_institution_id uuid default null,p_action text default 'grant',p_note text default null
) returns jsonb language sql security invoker
set search_path=pg_catalog,private
as $$ select private.platform_manage_operator_permission(p_user_id,p_permission_key,p_institution_id,p_action,p_note); $$;

revoke all on function private.platform_operator_user_search(text) from public,anon;
revoke all on function private.platform_operator_permissions_directory() from public,anon;
revoke all on function private.platform_manage_operator_permission(uuid,text,uuid,text,text) from public,anon;
grant execute on function private.platform_operator_user_search(text) to authenticated;
grant execute on function private.platform_operator_permissions_directory() to authenticated;
grant execute on function private.platform_manage_operator_permission(uuid,text,uuid,text,text) to authenticated;
revoke all on function public.platform_operator_user_search(text) from public,anon;
revoke all on function public.platform_operator_permissions_directory() from public,anon;
revoke all on function public.platform_manage_operator_permission(uuid,text,uuid,text,text) from public,anon;
grant execute on function public.platform_operator_user_search(text) to authenticated;
grant execute on function public.platform_operator_permissions_directory() to authenticated;
grant execute on function public.platform_manage_operator_permission(uuid,text,uuid,text,text) to authenticated;