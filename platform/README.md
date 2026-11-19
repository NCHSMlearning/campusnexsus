# CampusNexus Digital Campus integration

The CampusNexus public website and CMS remain at the repository root. The Digital Campus application is connected under `platform/full-source` as a Git submodule pinned to source commit `52ec92d739c1f75732cb6701d80c75d010e7f61a`.

## Get the full application source

```bash
git clone --recurse-submodules https://github.com/NCHSMlearning/campusnexsus.git
# If already cloned:
git submodule update --init --recursive
```

The source repository contains the application, including HTML entry points, CSS, JavaScript modules, images, proxy API, Capacitor configuration and Supabase migrations. The small files in this directory are integration scaffolding; they are not a replacement for the full application source.

## Deployment status

The source connection is committed, but the application is not yet ready to serve from `https://campusnexus.co.ke/platform/`. Several original pages use root-absolute asset paths such as `/js/`, `/css/`, `/images/` and `/config.js`. A deployment must either publish the application on a dedicated app host/subdomain with its expected root paths, or build a correctly namespaced deployment and rewrite/validate all root-absolute references. The `platform/index.html` page is intentionally a status/holding page.

## Supabase separation

The Digital Campus source points to its own Supabase project (`lwhtjozfsmbyihenfunw`). The CampusNexus marketing website/CMS uses a different project (`irahplkvocaakjxuisto`). Keep these projects separate. Never apply Digital Campus migrations to the marketing/CMS database, and never put a Supabase service-role key in browser code. Public anon keys may be present in client configuration but must be protected by correct RLS policies.

## Critical Google service-account security

An embedded Google service-account private key was found in the source repository. The current source commit removes it from the working tree and requires `GOOGLE_SERVICE_ACCOUNT_JSON` from the hosting provider's secret store. This does **not** erase the key from Git history. Revoke/delete the exposed key in Google Cloud immediately, create a replacement key, and add its JSON only as a protected hosting secret. Do not commit it.

## Next deployment checks

1. Revoke the exposed Google service-account key and add a replacement as `GOOGLE_SERVICE_ACCOUNT_JSON` in the proxy host's secret settings.
2. Inspect all environment/configuration files and confirm no other credentials are committed.
3. Verify RLS and tenant-scoped access against the Digital Campus project.
4. Configure platform hosting separately from the marketing CMS.
5. Test Super Admin, institution onboarding, login, student, lecturer and administrator flows.
6. Confirm assets, deep links, PWA service-worker scope, redirects and mobile layouts.
7. Switch users to the new portal only after staging tests pass.
