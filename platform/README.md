# CampusNexus Digital Campus integration

The CampusNexus public website and CMS remain at the repository root. The Digital Campus application is connected under `platform/full-source` as a Git submodule pinned to source commit `b952b24c16c5c804527efd61c95fe7ced674454c`.

## Get the full application source

```bash
git clone --recurse-submodules https://github.com/NCHSMlearning/campusnexsus.git
# If already cloned:
git submodule update --init --recursive
```

The source repository contains the complete application, including its HTML entry points, CSS, JavaScript modules, images, proxy API, Capacitor configuration and Supabase migrations. The small files in this directory are integration/entry-point scaffolding; they are not a replacement for the full application source.

## Deployment status

The source connection is committed, but the application is not yet ready to serve from `https://campusnexus.co.ke/platform/`. Several original pages use root-absolute asset paths such as `/js/`, `/css/`, `/images/` and `/config.js`. A deployment must either:
- publish the application on a dedicated app host/subdomain with its expected root paths, or
- build a correctly namespaced `/platform/` deployment and rewrite/validate all root-absolute references.

Do not expose portal links as live until those checks pass. The `platform/index.html` page is intentionally a status/holding page.

## Supabase separation

The Digital Campus source currently points to its own Supabase project (`lwhtjozfsmbyihenfunw`). The CampusNexus marketing website/CMS uses a different project (`irahplkvocaakjxuisto`). Keep these projects separate. Never apply Digital Campus migrations to the marketing/CMS database, and never put a Supabase service-role key in browser code. Public anon keys may be present in client configuration but must be protected by correct RLS policies.

## Next deployment checks

1. Inspect the full source and all environment/configuration files.
2. Verify RLS and tenant-scoped access against the Digital Campus project.
3. Configure deployment secrets and hosting for the platform separately from the marketing CMS.
4. Test Super Admin, institution onboarding, login, student, lecturer and administrator flows.
5. Confirm assets, deep links, PWA service worker scope, redirects and mobile layouts.
6. Switch users to the new portal only after staging tests pass.
