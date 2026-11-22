/* Campus Nexus dashboard maintenance gate retired.
 * Institution-level access is managed by authorised controls in the Super Admin
 * dashboard. This compatibility stub intentionally performs no blocking,
 * sign-out, redirect, or local-storage cleanup.
 */
(function () {
  'use strict';
  window.CampusNexusDashboardMaintenance = Object.freeze({ enabled: false });
})();
