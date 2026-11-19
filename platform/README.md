# CampusNexus Digital Campus — consolidated architecture

## Migration decision

CampusNexus is the platform shell and multi-institution control plane. The NCHSM Digital Campus repository remains the canonical application source and is mounted here at platform/full-source as a Git submodule.

- Source: https://github.com/NCHSMlearning/NCHSM-Digital-campus-
- Pinned source revision: 52ec92d739c1f75732cb6701d80c75d010e7f61a
- Submodule path: platform/full-source
- Submodule config: .gitmodules

This is an intentional source-level consolidation: one canonical copy of the full application, version-pinned inside CampusNexus. It avoids two independently edited copies drifting apart and preserves the original NCHSM portal while the multi-institution rollout is prepared.

## Repository boundaries

| Area | Responsibility | Source of truth |
|---|---|---|
| Repository root | CampusNexus public website and CMS | This repository |
| platform/ | Platform shell, onboarding and institution-management integration | This repository |
| platform/full-source/ | Full Digital Campus application (HTML, JS, CSS, images, proxy API and migrations) | Git submodule; source repository |
| Digital Campus Supabase | Student, academic, finance and institutional application data | Project lwhtjozfsmbyihenfunw |
| CampusNexus CMS Supabase | Marketing website/CMS data | Project irahplkvocaakjxuisto |

Do not merge the two Supabase projects or apply one application's migrations to the other. Do not place service-role keys or provider secrets in browser code.

## Avoiding duplicate/stale application copies

There are older application-related files in the CampusNexus root and in platform/ from earlier integration attempts. They are not a second authoritative copy of the full source. Do not bulk-overwrite them or edit them as substitutes for files in platform/full-source/. When changing an application feature, update the canonical source repository first, then advance the submodule pointer in CampusNexus after review. Keep CampusNexus-specific multi-tenant integration code in platform/.

## Clone and update

```bash
git clone --recurse-submodules https://github.com/NCHSMlearning/campusnexsus.git
cd campusnexsus
git submodule update --init --recursive

# After a reviewed source change:
git submodule update --remote --merge platform/full-source
git add .gitmodules platform/full-source
git commit -m "Update Digital Campus source reference"
git push origin main
```

The CampusNexus CI workflow validates that the submodule initializes and that required application entry points and directories are present.

## Deployment status — staging required

The submodule connection is in place and its GitHub Actions validation passed. This does not mean the full application is already deployed and working under https://campusnexus.co.ke/platform/.

The original application uses root-absolute paths such as /js/, /css/, /images/ and /config.js. Publishing it below /platform/ without a path strategy will cause asset, navigation, manifest and service-worker conflicts with the CampusNexus website. The safest first production arrangement is a dedicated application hostname whose root maps to the Digital Campus application. A namespaced /platform/ deployment requires a deliberate audit and rewrite of all root-absolute references, deep links, redirects, manifest URLs and service-worker scope.

The platform/index.html page is an integration launcher, not proof that all destination links are production-ready. Do not switch users to it until staging tests pass.

## Security and tenant isolation gates

1. Revoke the Google service-account key previously exposed in source Git history. Create a replacement and store its JSON only as the protected hosting secret GOOGLE_SERVICE_ACCOUNT_JSON. Removing a key from the latest source commit does not revoke it or erase historical copies.
2. Audit configuration files and deployment secrets for other committed credentials.
3. Verify row-level security and institution/tenant scoping in the Digital Campus Supabase project. Every institution-owned read and write must be scoped server-side; hiding UI controls is not authorization.
4. Keep the CMS and Digital Campus databases separate.
5. Test platform super-admin, institution creation, institution administrator provisioning, institution-specific login, student, lecturer, administrator, examinations, results, finance, attendance and file uploads.
6. Test desktop/mobile layouts, direct deep links, asset loading, redirects, PWA install/update and service-worker scope.
7. Switch users only after the staging checks are recorded as passed.

## Verified migration check

GitHub Actions run https://github.com/NCHSMlearning/campusnexsus/actions/runs/44525893634 completed successfully on 19 November 2026. It confirmed that the recursive submodule checkout contains the required login, super-admin, student, lecturer and administrator entry points, plus the JS, CSS, images, Supabase and proxy API directories.

The CI check validates source presence and structure; it does not perform a browser login, database migration, security penetration test or production deployment.
