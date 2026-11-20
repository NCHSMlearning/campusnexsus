-- Trusted database synchronization may preserve approved state.
-- Authenticated self-registration remains forced to pending; users cannot self-approve.

CREATE OR REPLACE FUNCTION private.enforce_pending_institution_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, private, auth
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF lower(coalesce(NEW.role, '')) IN ('student', 'lecturer')
       AND auth.uid() IS NOT NULL THEN
      NEW.status := 'pending';
      NEW.login_enabled := false;
    END IF;
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id
     AND lower(coalesce(OLD.role, '')) IN ('student', 'lecturer') THEN
    NEW.role := OLD.role;
    IF lower(coalesce(OLD.status, '')) NOT IN ('approved', 'active') THEN
      NEW.status := 'pending';
      NEW.login_enabled := false;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
