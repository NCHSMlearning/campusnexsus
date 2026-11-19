# Campus Nexus Examination Management

## Active tenant-scoped entry point
- Public route: `/exams` (also `/admin-exams`)
- Page: `platform/examinations/index.html`
- Client logic: `platform/examinations/exam-admin.js`
- Styles: `platform/examinations/exam-admin.css`

The active page uses the shared Digital Campus Supabase authentication project and verifies the signed-in user before loading institution data. Institution administrators must have an active `institution_users` membership with role `institution_admin`. Platform superadmins can select an institution. The page checks the institution's enabled `admin_exams` or `examinations` module before loading records.

Current implemented workflows:
- Institution-scoped examination list and dashboard metrics
- Create examination drafts with programme, block, date, duration, total marks and pass mark
- Submit new examinations in `pending` approval state; they are not automatically published
- View and add MCQ questions to an institution's examinations
- Review institution-scoped proctoring events
- Review examination attendance
- Review attempt status and attempt-level scores

## Database security
The shared Digital Campus database already contains institution records and the exam tables. Restrictive RLS tenant boundaries now scope child exam records by the parent exam's `institution_id` for:
- `exam_questions`
- `exam_grades`
- `exam_heartbeats`
- `exam_attendance`
- `released_exam_results`
- `questions`

An additional institution-admin policy allows attendance management only for exams in the administrator's institution. Existing RLS boundaries on `exams`, `exam_attempts`, and `exam_proctoring_logs` remain in place.

## Preserved legacy source
The original NCHSM admin/examination source remains under `source/`:
- `admin.html`, `adminexams.html`, `admin.js`, `style.css`
- `js/admindashboard.js`, `js/admin-questions.js`, `js/admin-exams-access-audit.js`
- `css/admindashboard.css`, `css/admin-exams-modern.css`

These files are preserved for feature-by-feature migration. They are not the active route. Their legacy RPCs and NCHSM assumptions require a separate authorization and tenant-context review before exposing the full legacy console to institution administrators.

## Operational note
The live page requires a user with an active institution administrator membership, or a platform superadmin session. Nyanchwa's examination module is enabled, but its active administrator membership must be claimed/assigned before a Nyanchwa institution administrator can enter.