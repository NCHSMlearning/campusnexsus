-- Campus Nexus: standardize institution school identifiers to exactly 3 digits.
-- Existing 12-digit identifiers are reassigned deterministically in creation order.

BEGIN;

DROP TRIGGER IF EXISTS trg_assign_institution_school_code ON public.institutions;
ALTER TABLE public.institutions DROP CONSTRAINT IF EXISTS institutions_school_code_format_check;

DO $$
DECLARE
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.institutions;
  IF v_count > 900 THEN
    RAISE EXCEPTION 'Cannot assign unique three-digit school codes: % institutions exceed the 900-code range (100-999).', v_count;
  END IF;
END;
$$;

WITH numbered AS (
  SELECT id, (99 + row_number() OVER (ORDER BY created_at NULLS FIRST, id))::text AS new_code
  FROM public.institutions
)
UPDATE public.institutions AS i
   SET school_code = numbered.new_code
  FROM numbered
 WHERE i.id = numbered.id;

CREATE OR REPLACE FUNCTION private.generate_institution_school_code()
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, private
AS $$
DECLARE
  v_code text;
BEGIN
  LOOP
    v_code := (100 + floor(random() * 900)::integer)::text;
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.institutions i WHERE i.school_code = v_code
    );
  END LOOP;
  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION private.assign_institution_school_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, private
AS $$
BEGIN
  IF NEW.school_code IS NULL OR btrim(NEW.school_code) = '' THEN
    NEW.school_code := private.generate_institution_school_code();
  ELSE
    NEW.school_code := regexp_replace(NEW.school_code, '[[:space:]-]+', '', 'g');
  END IF;

  IF NEW.school_code !~ '^[0-9]{3}$' THEN
    RAISE EXCEPTION 'School code must contain exactly 3 digits'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_institution_school_code
BEFORE INSERT OR UPDATE OF school_code ON public.institutions
FOR EACH ROW
EXECUTE FUNCTION private.assign_institution_school_code();

ALTER TABLE public.institutions
  ADD CONSTRAINT institutions_school_code_format_check
  CHECK (school_code ~ '^[0-9]{3}$');

CREATE UNIQUE INDEX IF NOT EXISTS institutions_school_code_uidx
  ON public.institutions (school_code);

REVOKE ALL ON FUNCTION private.generate_institution_school_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.assign_institution_school_code() FROM PUBLIC, anon, authenticated;

COMMIT;
