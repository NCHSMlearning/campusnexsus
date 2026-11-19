CREATE OR REPLACE FUNCTION public.assign_new_auth_user_institution()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'private', 'auth', 'extensions', 'vault'
AS $function$
DECLARE
  v_code text;
  v_institution_id uuid;
  v_link_id uuid;
  v_admin_email text;
  v_claimed_user uuid;
  v_is_first_admin boolean := false;
BEGIN
  v_code := lower(trim(coalesce(new.raw_user_meta_data->>'institution_code','')));
  IF v_code = '' THEN
    v_code := public.resolve_institution_registration_code(new.raw_user_meta_data->>'portal_host');
  END IF;
  SELECT l.id,l.institution_id INTO v_link_id,v_institution_id
  FROM public.institution_registration_links l
  JOIN public.institutions i ON i.id=l.institution_id
  WHERE lower(l.code)=v_code AND l.is_active=true
    AND (l.expires_at IS NULL OR l.expires_at>now())
    AND (l.max_uses IS NULL OR l.use_count<l.max_uses)
    AND i.status='active'
  ORDER BY l.created_at DESC LIMIT 1;
  IF v_institution_id IS NULL THEN
    RAISE WARNING 'No active institution registration link found for registration request';
    RETURN new;
  END IF;
  SELECT admin_email,first_admin_user_id INTO v_admin_email,v_claimed_user
  FROM public.institutions WHERE id=v_institution_id FOR UPDATE;
  IF v_claimed_user IS NULL AND v_admin_email IS NOT NULL
     AND lower(trim(v_admin_email))=lower(trim(new.email))
     AND lower(coalesce(new.raw_user_meta_data->>'role','')) IN ('institution_admin','admin') THEN
    UPDATE public.institutions SET first_admin_user_id=new.id,first_admin_claimed_at=now(),updated_at=now()
    WHERE id=v_institution_id AND first_admin_user_id IS NULL;
    v_is_first_admin := found;
  END IF;
  UPDATE public.consolidated_user_profiles_table
  SET institution_id=v_institution_id,
      role=CASE WHEN v_is_first_admin THEN 'admin' ELSE role END,
      status=CASE WHEN v_is_first_admin THEN 'active' ELSE status END,
      updated_at=now()
  WHERE user_id=new.id;
  IF v_is_first_admin THEN
    INSERT INTO public.institution_users(institution_id,user_id,role,status)
    VALUES(v_institution_id,new.id,'institution_admin','active')
    ON CONFLICT(institution_id,user_id) DO UPDATE SET role='institution_admin',status='active';
  END IF;
  UPDATE public.institution_registration_links SET use_count=use_count+1 WHERE id=v_link_id;
  RETURN new;
END;
$function$;