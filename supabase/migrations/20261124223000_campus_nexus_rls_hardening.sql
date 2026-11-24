-- Campus Nexus RLS hardening for private student activity and assessment tables.
-- Safe to re-run: policies are dropped before they are recreated.

BEGIN;

DROP POLICY IF EXISTS "Allow anon to view exams" ON public.cats_exams;
DROP POLICY IF EXISTS "Allow delete on cats_exams" ON public.cats_exams;
DROP POLICY IF EXISTS "Allow insert on cats_exams" ON public.cats_exams;
DROP POLICY IF EXISTS "Allow select on cats_exams" ON public.cats_exams;
DROP POLICY IF EXISTS "Allow update on cats_exams" ON public.cats_exams;

DROP POLICY IF EXISTS "Allow anon to insert" ON public.nurseiq_attempts;
DROP POLICY IF EXISTS "Allow anon to select" ON public.nurseiq_attempts;
DROP POLICY IF EXISTS "Allow all authenticated users" ON public.nurseiq_attempts;

DROP POLICY IF EXISTS "legacy_anon_public_read" ON public.newsletter_reads;
DROP POLICY IF EXISTS "legacy_authenticated_non_director_access" ON public.newsletter_reads;
DROP POLICY IF EXISTS "legacy_anon_public_read" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "legacy_authenticated_non_director_access" ON public.newsletter_subscribers;
DROP POLICY IF EXISTS "legacy_anon_public_read" ON public.user_progress;
DROP POLICY IF EXISTS "legacy_authenticated_non_director_access" ON public.user_progress;
DROP POLICY IF EXISTS "legacy_anon_public_read" ON public.user_assessment_progress;
DROP POLICY IF EXISTS "legacy_authenticated_non_director_access" ON public.user_assessment_progress;

DROP POLICY IF EXISTS "cn_user_owns_newsletter_reads" ON public.newsletter_reads;
CREATE POLICY "cn_user_owns_newsletter_reads"
ON public.newsletter_reads FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "cn_user_owns_newsletter_subscriptions" ON public.newsletter_subscribers;
CREATE POLICY "cn_user_owns_newsletter_subscriptions"
ON public.newsletter_subscribers FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "cn_user_owns_progress" ON public.user_progress;
CREATE POLICY "cn_user_owns_progress"
ON public.user_progress FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "cn_user_owns_assessment_progress" ON public.user_assessment_progress;
CREATE POLICY "cn_user_owns_assessment_progress"
ON public.user_assessment_progress FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "cn_public_newsletter_signup" ON public.newsletter_subscribers;
CREATE POLICY "cn_public_newsletter_signup"
ON public.newsletter_subscribers FOR INSERT TO anon
WITH CHECK (user_id IS NULL);

REVOKE ALL PRIVILEGES ON TABLE
  public.cats_exams,
  public.nurseiq_attempts,
  public.newsletter_reads,
  public.newsletter_subscribers,
  public.user_progress,
  public.user_assessment_progress
FROM PUBLIC;

REVOKE ALL PRIVILEGES ON TABLE
  public.cats_exams,
  public.nurseiq_attempts,
  public.newsletter_reads,
  public.user_progress,
  public.user_assessment_progress
FROM anon;

REVOKE ALL PRIVILEGES ON TABLE public.newsletter_subscribers FROM anon;
GRANT INSERT ON TABLE public.newsletter_subscribers TO anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.cats_exams,
  public.nurseiq_attempts,
  public.newsletter_reads,
  public.newsletter_subscribers,
  public.user_progress,
  public.user_assessment_progress
TO authenticated;

COMMIT;
