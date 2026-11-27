-- Scheduled, institution-scoped unit registration windows (Kenya time is used by the UI).
ALTER TABLE public.institution_unit_registration_controls
  ADD COLUMN IF NOT EXISTS opens_at timestamptz,
  ADD COLUMN IF NOT EXISTS closes_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_my_unit_registration_control()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
DECLARE v_institution_id uuid; v_control public.institution_unit_registration_controls%ROWTYPE;
  v_now timestamptz := now(); v_effective_open boolean; v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT p.institution_id INTO v_institution_id FROM public.consolidated_user_profiles_table p WHERE p.user_id=auth.uid() LIMIT 1;
  IF v_institution_id IS NULL THEN
    SELECT iu.institution_id INTO v_institution_id FROM public.institution_users iu
    WHERE iu.user_id=auth.uid() AND lower(trim(iu.status))='active'
    ORDER BY iu.created_at DESC NULLS LAST LIMIT 1;
  END IF;
  IF v_institution_id IS NULL THEN RAISE EXCEPTION 'Your institution could not be resolved'; END IF;
  SELECT * INTO v_control FROM public.institution_unit_registration_controls WHERE institution_id=v_institution_id;
  v_effective_open := coalesce(v_control.is_open,true)
    AND (v_control.opens_at IS NULL OR v_control.opens_at <= v_now)
    AND (v_control.closes_at IS NULL OR v_control.closes_at > v_now);
  v_status := CASE
    WHEN NOT coalesce(v_control.is_open,true) THEN 'manually_closed'
    WHEN v_control.opens_at IS NOT NULL AND v_control.opens_at > v_now THEN 'scheduled'
    WHEN v_control.closes_at IS NOT NULL AND v_control.closes_at <= v_now THEN 'deadline_passed'
    WHEN v_effective_open THEN 'open' ELSE 'closed' END;
  RETURN jsonb_build_object('institution_id',v_institution_id,'is_open',v_effective_open,
    'manual_open',coalesce(v_control.is_open,true),'status',v_status,
    'opens_at',v_control.opens_at,'closes_at',v_control.closes_at,'server_now',v_now,
    'closed_message',coalesce(v_control.closed_message,'Unit registration is currently closed. Please contact your institution administrator.'),
    'updated_at',v_control.updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_my_unit_registration_control(
  p_is_open boolean,
  p_closed_message text DEFAULT 'Unit registration is currently closed. Please contact your institution administrator.',
  p_opens_at timestamptz DEFAULT NULL,
  p_closes_at timestamptz DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
DECLARE v_institution_id uuid; v_result public.institution_unit_registration_controls%ROWTYPE;
  v_now timestamptz := now(); v_effective_open boolean; v_status text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT p.institution_id INTO v_institution_id FROM public.consolidated_user_profiles_table p WHERE p.user_id=auth.uid() LIMIT 1;
  IF v_institution_id IS NULL THEN
    SELECT iu.institution_id INTO v_institution_id FROM public.institution_users iu
    WHERE iu.user_id=auth.uid() AND lower(trim(iu.status))='active' AND lower(trim(iu.role))='institution_admin'
    ORDER BY iu.created_at DESC NULLS LAST LIMIT 1;
  END IF;
  IF v_institution_id IS NULL OR NOT private.has_active_institution_admin_access(v_institution_id) THEN
    RAISE EXCEPTION 'Only an active institution administrator can change unit registration access';
  END IF;
  IF p_opens_at IS NOT NULL AND p_closes_at IS NOT NULL AND p_closes_at <= p_opens_at THEN
    RAISE EXCEPTION 'The closing deadline must be later than the opening date and time';
  END IF;
  INSERT INTO public.institution_unit_registration_controls(institution_id,is_open,closed_message,opens_at,closes_at,updated_by,updated_at)
  VALUES(v_institution_id,p_is_open,
    coalesce(nullif(left(trim(p_closed_message),500),''),'Unit registration is currently closed. Please contact your institution administrator.'),
    p_opens_at,p_closes_at,auth.uid(),v_now)
  ON CONFLICT(institution_id) DO UPDATE SET is_open=EXCLUDED.is_open,closed_message=EXCLUDED.closed_message,
    opens_at=EXCLUDED.opens_at,closes_at=EXCLUDED.closes_at,updated_by=EXCLUDED.updated_by,updated_at=v_now
  RETURNING * INTO v_result;
  v_effective_open := v_result.is_open AND (v_result.opens_at IS NULL OR v_result.opens_at<=v_now)
    AND (v_result.closes_at IS NULL OR v_result.closes_at>v_now);
  v_status := CASE WHEN NOT v_result.is_open THEN 'manually_closed'
    WHEN v_result.opens_at IS NOT NULL AND v_result.opens_at>v_now THEN 'scheduled'
    WHEN v_result.closes_at IS NOT NULL AND v_result.closes_at<=v_now THEN 'deadline_passed'
    WHEN v_effective_open THEN 'open' ELSE 'closed' END;
  RETURN jsonb_build_object('institution_id',v_result.institution_id,'is_open',v_effective_open,
    'manual_open',v_result.is_open,'status',v_status,'opens_at',v_result.opens_at,'closes_at',v_result.closes_at,
    'server_now',v_now,'closed_message',v_result.closed_message,'updated_at',v_result.updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_institution_unit_registration_open()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
DECLARE v_open boolean; v_message text; v_opens_at timestamptz; v_closes_at timestamptz; v_now timestamptz := now();
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status='pending' THEN RETURN NEW; END IF;
  IF NEW.institution_id IS NULL THEN RAISE EXCEPTION 'Institution is required for unit registration'; END IF;
  SELECT is_open,closed_message,opens_at,closes_at INTO v_open,v_message,v_opens_at,v_closes_at
  FROM public.institution_unit_registration_controls WHERE institution_id=NEW.institution_id;
  IF coalesce(v_open,true)=false THEN
    RAISE EXCEPTION '%',coalesce(v_message,'Unit registration is currently closed.') USING ERRCODE='P0001';
  END IF;
  IF v_opens_at IS NOT NULL AND v_opens_at>v_now THEN
    RAISE EXCEPTION 'Unit registration has not opened yet.' USING ERRCODE='P0001';
  END IF;
  IF v_closes_at IS NOT NULL AND v_closes_at<=v_now THEN
    RAISE EXCEPTION 'The unit registration deadline has passed.' USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_unit_registration_control(boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_my_unit_registration_control(boolean,text,timestamptz,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_unit_registration_control(boolean,text,timestamptz,timestamptz) TO authenticated;

-- Preserve compatibility with older administrator pages: toggling access must not erase saved dates.
CREATE OR REPLACE FUNCTION public.set_my_unit_registration_control(
  p_is_open boolean,
  p_closed_message text DEFAULT 'Unit registration is currently closed. Please contact your institution administrator.'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
DECLARE v_institution_id uuid; v_opens_at timestamptz; v_closes_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT p.institution_id INTO v_institution_id FROM public.consolidated_user_profiles_table p WHERE p.user_id=auth.uid() LIMIT 1;
  IF v_institution_id IS NULL THEN
    SELECT iu.institution_id INTO v_institution_id FROM public.institution_users iu
    WHERE iu.user_id=auth.uid() AND lower(trim(iu.status))='active' AND lower(trim(iu.role))='institution_admin'
    ORDER BY iu.created_at DESC NULLS LAST LIMIT 1;
  END IF;
  IF v_institution_id IS NULL OR NOT private.has_active_institution_admin_access(v_institution_id) THEN
    RAISE EXCEPTION 'Only an active institution administrator can change unit registration access';
  END IF;
  SELECT opens_at,closes_at INTO v_opens_at,v_closes_at
  FROM public.institution_unit_registration_controls WHERE institution_id=v_institution_id;
  RETURN public.set_my_unit_registration_control(p_is_open,p_closed_message,v_opens_at,v_closes_at);
END;
$$;
REVOKE ALL ON FUNCTION public.set_my_unit_registration_control(boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_unit_registration_control(boolean,text) TO authenticated;
