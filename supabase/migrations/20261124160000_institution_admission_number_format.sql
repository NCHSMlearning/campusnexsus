-- Institution-specific admission number format and atomic sequence generation.
alter table public.institutions add column if not exists admission_prefix text;
update public.institutions set admission_prefix='NASHS'
where school_code='102' and lower(name) like '%nyanchwa%';

create or replace function public.generate_institution_admission_number(
  p_institution_id uuid,p_program_code text,p_intake_code text
) returns text language plpgsql security definer
set search_path=pg_catalog,public
as $$
declare v_prefix text; v_program text:=upper(regexp_replace(trim(coalesce(p_program_code,'')),'[^A-Z0-9]','','g'));
v_intake text:=upper(regexp_replace(trim(coalesce(p_intake_code,'')),'[^A-Z0-9]','','g'));
v_serial integer; v_pattern text;
begin
 if p_institution_id is null or v_program='' or v_intake='' then raise exception 'Institution, programme and intake are required'; end if;
 select upper(trim(admission_prefix)) into v_prefix from public.institutions where id=p_institution_id and status='active';
 if v_prefix is null or v_prefix='' then raise exception 'Admission prefix is not configured for this institution'; end if;
 if length(v_prefix)>16 or length(v_program)>12 or length(v_intake)>8 then raise exception 'Invalid admission number component'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_institution_id::text||':'||v_program||':'||v_intake,0));
 v_pattern:='^'||v_prefix||'/'||v_program||'/'||v_intake||'/([0-9]{3,})$';
 select coalesce(max((regexp_match(x,v_pattern))[1]::integer),0)+1 into v_serial from (
  select admission_number x from public.consolidated_user_profiles_table where institution_id=p_institution_id and admission_number ~ v_pattern
  union all select admission_number x from public.students where institution_id=p_institution_id and admission_number ~ v_pattern
 ) q;
 return v_prefix||'/'||v_program||'/'||v_intake||'/'||lpad(v_serial::text,3,'0');
end; $$;
revoke all on function public.generate_institution_admission_number(uuid,text,text) from public;
grant execute on function public.generate_institution_admission_number(uuid,text,text) to anon,authenticated;

create or replace function public.resolve_institution_registration_context(p_code text default null,p_host text default null)
returns jsonb language plpgsql stable security definer
set search_path to 'pg_catalog','public','private','auth'
as $function$
declare v_code text:=regexp_replace(lower(trim(coalesce(p_code,''))),'[[:space:]-]+','','g');
v_host text:=lower(regexp_replace(regexp_replace(split_part(trim(coalesce(p_host,'')),':',1),'^https?://','','i'),'/+$','','g'));
v_result jsonb;
begin
 if v_code='' and v_host<>'' then
  select l.code into v_code from public.institutions i join public.institution_registration_links l on l.institution_id=i.id
  where lower(regexp_replace(regexp_replace(trim(coalesce(i.portal_domain,'')),'^https?://','','i'),'/+$','','g'))=v_host
   and i.status='active' and l.is_active=true and (l.expires_at is null or l.expires_at>now())
   and (l.max_uses is null or l.use_count<l.max_uses) order by l.created_at desc limit 1;
  v_code:=regexp_replace(lower(trim(coalesce(v_code,''))),'[[:space:]-]+','','g');
 end if;
 if v_code='' then return null; end if;
 select jsonb_build_object('institution_id',i.id,'institution_name',i.name,'short_code',i.short_code,
  'school_code',i.school_code,'admission_prefix',i.admission_prefix,'logo_url',i.logo_url,
  'brand_colors',i.brand_colors,'primary_color',i.primary_color,'secondary_color',i.secondary_color,
  'physical_address',i.physical_address,'postal_address',i.postal_address,
  'notification_email',coalesce(nullif(trim(i.admin_email),''),nullif(trim(i.contact_email),'')))
 into v_result from public.institutions i where i.status='active' and (
  regexp_replace(lower(coalesce(i.school_code,'')),'[[:space:]-]+','','g')=v_code
  or exists(select 1 from public.institution_registration_links l where l.institution_id=i.id and l.is_active=true
   and regexp_replace(lower(l.code),'[[:space:]-]+','','g')=v_code
   and (l.expires_at is null or l.expires_at>now()) and (l.max_uses is null or l.use_count<l.max_uses)))
 order by i.created_at desc nulls last limit 1;
 return v_result;
end; $function$;
