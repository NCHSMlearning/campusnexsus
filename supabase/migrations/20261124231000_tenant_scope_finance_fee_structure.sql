-- Tenant-scope fee structures and finance staff access.
-- Existing fee rows are the legacy NCHSM fee schedule and are assigned to school 101.
-- Nyanchwa (102) must configure its own fee schedule before fees are displayed.

BEGIN;

ALTER TABLE public.finance_fee_structure
  ADD COLUMN IF NOT EXISTS institution_id uuid;

UPDATE public.finance_fee_structure
SET institution_id = (SELECT id FROM public.institutions WHERE school_code='101' LIMIT 1)
WHERE institution_id IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.finance_fee_structure WHERE institution_id IS NULL) THEN
    RAISE EXCEPTION 'finance_fee_structure has rows without an institution; resolve institution ownership before applying this migration';
  END IF;
END $$;

ALTER TABLE public.finance_fee_structure
  ALTER COLUMN institution_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid='public.finance_fee_structure'::regclass
      AND conname='finance_fee_structure_institution_id_fkey'
  ) THEN
    ALTER TABLE public.finance_fee_structure
      ADD CONSTRAINT finance_fee_structure_institution_id_fkey
      FOREIGN KEY (institution_id) REFERENCES public.institutions(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_finance_fee_structure_institution_program
  ON public.finance_fee_structure(institution_id, program, is_active, period_index);

ALTER POLICY cn_module_entitlement_guard ON public.finance_fee_structure
  USING (private.module_entitlement_allows(institution_id, 'finance'))
  WITH CHECK (private.module_entitlement_allows(institution_id, 'finance'));

DROP POLICY IF EXISTS finance_fee_structure_student_select ON public.finance_fee_structure;
DROP POLICY IF EXISTS finance_fee_structure_admin_select ON public.finance_fee_structure;
DROP POLICY IF EXISTS finance_fee_structure_admin_insert ON public.finance_fee_structure;
DROP POLICY IF EXISTS finance_fee_structure_admin_update ON public.finance_fee_structure;
DROP POLICY IF EXISTS legacy_authenticated_non_director_access ON public.finance_fee_structure;

CREATE POLICY finance_fee_structure_student_select
ON public.finance_fee_structure FOR SELECT TO authenticated
USING (
  is_active = true
  AND institution_id = (
    SELECT p.institution_id FROM public.consolidated_user_profiles_table p
    WHERE p.user_id = auth.uid()
      AND lower(coalesce(p.role,'')) = 'student'
      AND lower(coalesce(p.status,'')) IN ('approved','active')
      AND coalesce(p.login_enabled,true) = true
    LIMIT 1
  )
);

CREATE POLICY finance_fee_structure_admin_select
ON public.finance_fee_structure FOR SELECT TO authenticated
USING (
  private.is_primary_superadmin()
  OR EXISTS (
    SELECT 1 FROM public.consolidated_user_profiles_table p
    WHERE p.user_id=auth.uid() AND p.institution_id=finance_fee_structure.institution_id
      AND lower(coalesce(p.role,'')) IN ('institution_admin','finance_officer','admin','superadmin')
      AND lower(coalesce(p.status,'')) IN ('approved','active')
      AND coalesce(p.login_enabled,true)=true
  )
);

CREATE POLICY finance_fee_structure_admin_insert
ON public.finance_fee_structure FOR INSERT TO authenticated
WITH CHECK (
  private.is_primary_superadmin()
  OR EXISTS (
    SELECT 1 FROM public.consolidated_user_profiles_table p
    WHERE p.user_id=auth.uid() AND p.institution_id=finance_fee_structure.institution_id
      AND lower(coalesce(p.role,'')) IN ('institution_admin','finance_officer','admin')
      AND lower(coalesce(p.status,'')) IN ('approved','active')
      AND coalesce(p.login_enabled,true)=true
  )
);

CREATE POLICY finance_fee_structure_admin_update
ON public.finance_fee_structure FOR UPDATE TO authenticated
USING (
  private.is_primary_superadmin()
  OR EXISTS (
    SELECT 1 FROM public.consolidated_user_profiles_table p
    WHERE p.user_id=auth.uid() AND p.institution_id=finance_fee_structure.institution_id
      AND lower(coalesce(p.role,'')) IN ('institution_admin','finance_officer','admin')
      AND lower(coalesce(p.status,'')) IN ('approved','active')
      AND coalesce(p.login_enabled,true)=true
  )
)
WITH CHECK (
  private.is_primary_superadmin()
  OR EXISTS (
    SELECT 1 FROM public.consolidated_user_profiles_table p
    WHERE p.user_id=auth.uid() AND p.institution_id=finance_fee_structure.institution_id
      AND lower(coalesce(p.role,'')) IN ('institution_admin','finance_officer','admin')
      AND lower(coalesce(p.status,'')) IN ('approved','active')
      AND coalesce(p.login_enabled,true)=true
  )
);

DROP POLICY IF EXISTS finance_student_accounts_admin_select ON public.finance_student_accounts;
CREATE POLICY finance_student_accounts_admin_select
ON public.finance_student_accounts FOR SELECT TO authenticated
USING (
  private.is_primary_superadmin()
  OR EXISTS (
    SELECT 1 FROM public.consolidated_user_profiles_table p
    WHERE p.user_id=auth.uid() AND p.institution_id=finance_student_accounts.institution_id
      AND lower(coalesce(p.role,'')) IN ('institution_admin','finance_officer','admin','superadmin')
      AND lower(coalesce(p.status,'')) IN ('approved','active')
      AND coalesce(p.login_enabled,true)=true
  )
);

DROP POLICY IF EXISTS finance_payments_admin_select ON public.finance_payments;
DROP POLICY IF EXISTS finance_payments_admin_insert ON public.finance_payments;
DROP POLICY IF EXISTS finance_payments_admin_update ON public.finance_payments;
DROP POLICY IF EXISTS legacy_authenticated_non_director_access ON public.finance_payments;

CREATE POLICY finance_payments_admin_select
ON public.finance_payments FOR SELECT TO authenticated
USING (
  private.is_primary_superadmin()
  OR EXISTS (
    SELECT 1 FROM public.consolidated_user_profiles_table staff
    JOIN public.consolidated_user_profiles_table student ON student.user_id=finance_payments.student_id
    WHERE staff.user_id=auth.uid() AND staff.institution_id=student.institution_id
      AND lower(coalesce(staff.role,'')) IN ('institution_admin','finance_officer','admin','superadmin')
      AND lower(coalesce(staff.status,'')) IN ('approved','active')
      AND coalesce(staff.login_enabled,true)=true
  )
);

CREATE POLICY finance_payments_admin_insert
ON public.finance_payments FOR INSERT TO authenticated
WITH CHECK (
  private.is_primary_superadmin()
  OR EXISTS (
    SELECT 1 FROM public.consolidated_user_profiles_table staff
    JOIN public.consolidated_user_profiles_table student ON student.user_id=finance_payments.student_id
    WHERE staff.user_id=auth.uid() AND staff.institution_id=student.institution_id
      AND lower(coalesce(staff.role,'')) IN ('institution_admin','finance_officer','admin')
      AND lower(coalesce(staff.status,'')) IN ('approved','active')
      AND coalesce(staff.login_enabled,true)=true
  )
);

CREATE POLICY finance_payments_admin_update
ON public.finance_payments FOR UPDATE TO authenticated
USING (
  private.is_primary_superadmin()
  OR EXISTS (
    SELECT 1 FROM public.consolidated_user_profiles_table staff
    JOIN public.consolidated_user_profiles_table student ON student.user_id=finance_payments.student_id
    WHERE staff.user_id=auth.uid() AND staff.institution_id=student.institution_id
      AND lower(coalesce(staff.role,'')) IN ('institution_admin','finance_officer','admin')
      AND lower(coalesce(staff.status,'')) IN ('approved','active')
      AND coalesce(staff.login_enabled,true)=true
  )
)
WITH CHECK (
  private.is_primary_superadmin()
  OR EXISTS (
    SELECT 1 FROM public.consolidated_user_profiles_table staff
    JOIN public.consolidated_user_profiles_table student ON student.user_id=finance_payments.student_id
    WHERE staff.user_id=auth.uid() AND staff.institution_id=student.institution_id
      AND lower(coalesce(staff.role,'')) IN ('institution_admin','finance_officer','admin')
      AND lower(coalesce(staff.status,'')) IN ('approved','active')
      AND coalesce(staff.login_enabled,true)=true
  )
);

REVOKE ALL PRIVILEGES ON TABLE public.finance_fee_structure FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.finance_fee_structure TO authenticated;

COMMIT;
