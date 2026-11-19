# CampusNexus Digital Campus migration

This directory provides the CampusNexus platform entry points while preserving the existing CampusNexus marketing website and CMS at the repository root.

- The selected portal entry pages are mirrored here for direct access.
- `full-source` is linked to the complete upstream Digital Campus repository as a Git submodule at the source commit used for this migration.
- Initialize the complete source checkout with `git submodule update --init --recursive`.
- The Digital Campus Supabase project remains separate from the CampusNexus marketing/CMS Supabase project. Do not apply the platform migrations to the CMS project or copy production records as part of this source-code migration.

The mirrored pages are not yet a production deployment guarantee: verify relative asset paths, environment configuration, custom-domain routing, and the build/deployment pipeline before switching users over.