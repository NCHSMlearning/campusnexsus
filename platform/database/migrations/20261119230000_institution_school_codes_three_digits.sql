-- Campus Nexus: standardise institution school codes to exactly three digits.
-- Registration-link tokens remain separate and are not changed.

ALTER TABLE public.institutions
  DROP CONSTRAINT IF EXISTS institutions_school_code_format_check;

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
  -- Serialise allocation to reduce collisions between concurrent institution setup requests.
  PERFORM pg_advisory_xact_lock(hashtext('campus_nexus_three_digit_school_code'));

  IF (SELECT count(*) FROM public.institutions) >= 900 THEN
    RAISE EXCEPTION 'The three-digit school-code range (100–999) is full'
      USING ERRCODE = '54000';
  END IF;

  LOOP
    v_code := (100 + floor(random() * 900))::integer::text;
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

-- Reassign existing long codes. Registration-link tokens and institution IDs remain unchanged.
DO $$
DECLARE
  v_id uuid;
  v_count integer;
BEGIN
  SELECT count(*) INTO v_count FROM public.institutions;
  IF v_count > 900 THEN
    RAISE EXCEPTION 'Cannot migrate % institutions: only 900 unique three-digit school codes (100–999) are available', v_count
      USING ERRCODE = '54000';
  END IF;

  FOR v_id IN SELECT id FROM public.institutions ORDER BY created_at, id
  LOOP
    UPDATE public.institutions
       SET school_code = private.generate_institution_school_code()
     WHERE id = v_id;
  END LOOP;
END;
$$;

ALTER TABLE public.institutions
  ADD CONSTRAINT institutions_school_code_format_check
  CHECK (school_code ~ '^[0-9]{3}$');

REVOKE ALL ON FUNCTION private.generate_institution_school_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.assign_institution_school_code() FROM PUBLIC, anon, authenticated;
