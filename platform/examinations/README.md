# Examination module source staging

This folder preserves the existing NCHSM administration and examination implementation as the starting source for the Campus Nexus examination module.

## Source files copied
- `admin.html` — administration dashboard shell
- `adminexams.html` — admin examination dashboard and workflows
- `exam_dashboard.html` — student exam dashboard and exam entry interface
- `admin.js` — administration dashboard logic
- `style.css` — administration dashboard styling
- `js/admindashboard.js` — examination dashboard logic, question/attempt handling and related workflows
- `js/admin-questions.js` — question-bank management
- `js/admin-exams-access-audit.js` — examination dashboard access audit
- `css/admindashboard.css` and `css/admin-exams-modern.css` — exam dashboard styling

## Important integration status
These are preserved source files, not yet a live Campus Nexus route. The original NCHSM `config.js`, NCHSM maintenance gate, and NCHSM-only mobile script were intentionally not copied into this staging folder. The HTML still references the original app's global configuration and some root-absolute assets. Before enabling this module, adapt authentication, Supabase access, institution scoping/RLS, navigation, storage, audit logging and asset paths to the Campus Nexus platform. Do not point this module at a production tenant until those checks are complete.

The original NCHSM Digital Campus remains unchanged and continues to serve `nchsm.co.ke`.