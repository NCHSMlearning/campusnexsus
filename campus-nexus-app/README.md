# Campus Nexus Android App

Separate Android portal client. It is not the Campus Nexus Secure Exam Browser (CN-SEB).

- Android application ID: `co.ke.campusnexus.app`
- App version: `1.2.7`
- Opens the production Campus Nexus portal login over HTTPS and activates the native app navigation experience across supported role portals.
- Existing Supabase authentication and role-based portal authorization remain authoritative.
- Supports student, lecturer, institution administrator and superadmin portal routes available to the signed-in account.
- Secure examination lockdown remains a separate CN-SEB product.

The first CI APK is a debug-signed preview for installation and device testing. It is not a Play Store release. A production APK/AAB must be signed with the dedicated Campus Nexus release keystore stored in GitHub Actions secrets before public distribution.
