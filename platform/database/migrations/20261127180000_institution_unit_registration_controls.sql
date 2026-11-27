-- Institution-scoped unit-registration open/close control.
-- New institutions remain open by default until an administrator explicitly closes registration.

CREATE TABLE IF NOT EXISTS public.institution_unit_registration_controls (
  institution_id uuid PRIMARY KEY REFERENCES public.institutions(id) ON DELETE CASCADE,
  is_open boolean NOT NULL DEFAULT true,
  closed_message text NOT NULL DEFAULT 'Unit registration is currently closed. Please contact your institution administrator.',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.institution_unit_registration_controls ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.institution_unit_registration_controls FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.institution_unit_registration_controls TO service_role;

CREATE OR REPLACE FUNCTION public.get_my_unit_registration_control()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
DECLARE v_institution_id uuid; v_control public.institution_unit_registration_controls%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT p.institution_id INTO v_institution_id
  FROM public.consolidated_user_profiles_table p WHERE p.user_id=auth.uid() LIMIT 1;
  IF v_institution_id IS NULL THEN
    SELECT iu.institution_id INTO v_institution_id FROM public.institution_users iu
    WHERE iu.user_id=auth.uid() AND lower(trim(iu.status))='active'
    ORDER BY iu.created_at DESC NULLS LAST LIMIT 1;
  END IF;
  IF v_institution_id IS NULL THEN RAISE EXCEPTION 'Your institution could not be resolved'; END IF;
  SELECT * INTO v_control FROM public.institution_unit_registration_controls WHERE institution_id=v_institution_id;
  RETURN jsonb_build_object(
    'institution_id',v_institution_id,
    'is_open',coalesce(v_control.is_open,true),
    'closed_message',coalesce(v_control.closed_message,'Unit registration is currently closed. Please contact your institution administrator.'),
    'updated_at',v_control.updated_at
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_my_unit_registration_control(
  p_is_open boolean,
  p_closed_message text DEFAULT 'Unit registration is currently closed. Please contact your institution administrator.'
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
DECLARE v_institution_id uuid; v_result public.institution_unit_registration_controls%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT p.institution_id INTO v_institution_id
  FROM public.consolidated_user_profiles_table p WHERE p.user_id=auth.uid() LIMIT 1;
  IF v_institution_id IS NULL THEN
    SELECT iu.institution_id INTO v_institution_id FROM public.institution_users iu
    WHERE iu.user_id=auth.uid() AND lower(trim(iu.status))='active'
      AND lower(trim(iu.role))='institution_admin'
    ORDER BY iu.created_at DESC NULLS LAST LIMIT 1;
  END IF;
  IF v_institution_id IS NULL OR NOT private.has_active_institution_admin_access(v_institution_id) THEN
    RAISE EXCEPTION 'Only an active institution administrator can change unit registration access';
  END IF;
  INSERT INTO public.institution_unit_registration_controls(institution_id,is_open,closed_message,updated_by,updated_at)
  VALUES(v_institution_id,p_is_open,
    coalesce(nullif(left(trim(p_closed_message),500),''),'Unit registration is currently closed. Please contact your institution administrator.'),
    auth.uid(),now())
  ON CONFLICT(institution_id) DO UPDATE SET
    is_open=EXCLUDED.is_open,closed_message=EXCLUDED.closed_message,updated_by=EXCLUDED.updated_by,updated_at=now()
  RETURNING * INTO v_result;
  RETURN jsonb_build_object('institution_id',v_result.institution_id,'is_open',v_result.is_open,'closed_message',v_result.closed_message,'updated_at',v_result.updated_at);
END;
$$;

CREATE OR REPLACE FUNCTION public.enforce_institution_unit_registration_open()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
DECLARE v_open boolean; v_message text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'pending' THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status='pending' THEN RETURN NEW; END IF;
  IF NEW.institution_id IS NULL THEN
    RAISE EXCEPTION 'Institution is required for unit registration';
  END IF;
  SELECT is_open,closed_message INTO v_open,v_message
  FROM public.institution_unit_registration_controls WHERE institution_id=NEW.institution_id;
  IF coalesce(v_open,true)=false THEN
    RAISE EXCEPTION '%',coalesce(v_message,'Unit registration is currently closed.')
      USING ERRCODE='P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_institution_unit_registration_open ON public.student_unit_registrations;
CREATE TRIGGER trg_enforce_institution_unit_registration_open
BEFORE INSERT OR UPDATE OF status ON public.student_unit_registrations
FOR EACH ROW EXECUTE FUNCTION public.enforce_institution_unit_registration_open();

REVOKE ALL ON FUNCTION public.get_my_unit_registration_control() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_my_unit_registration_control(boolean,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_unit_registration_control() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_unit_registration_control(boolean,text) TO authenticated;
