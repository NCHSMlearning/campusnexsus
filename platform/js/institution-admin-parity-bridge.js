/* Tenant-safe adapters for the original Super Admin academic section controls.
 * All data work is delegated to the Institution Admin modules, which scope reads/writes
 * to CampusInstitutionAdmin.institutionId.
 */
(() => {
  "use strict";
  const notify = (message, error=false) => {
    if (typeof window.showNotification === "function") window.showNotification(message, error ? "error" : "success");
    else if (typeof window.showFeedback === "function") window.showFeedback(message, error ? "error" : "success");
    else console.info("[Campus Nexus]", message);
  };
  const click = id => document.getElementById(id)?.click();
  const change = id => document.getElementById(id)?.dispatchEvent(new Event("change", {bubbles:true}));
  window.refreshMarksData = async () => { await window.InstitutionAdminMarksEntry?.refresh?.(); await window.InstitutionAdminResults?.refresh?.(); };
  window.exportAllMarksData = () => window.InstitutionAdminMarksEntry?.export?.();
  window.loadMEBlocks = () => {};
  window.loadMEUnits = () => {};
  window.loadMarksEntry = () => click("iaMELoadStudents");
  window.loadMarksApprovals = () => window.InstitutionAdminResults?.refresh?.();
  window.approveAllPendingMarks = () => window.InstitutionAdminResults?.approveAll?.();
  window.rejectAllPendingMarks = () => window.InstitutionAdminResults?.rejectAll?.();
  window.filterMarksApprovals = () => {};
  window.refreshAnalytics = window.loadAnalyticsData = () => window.InstitutionAdminAnalytics?.refresh?.();
  window.exportAnalyticsReport = window.exportConsolidatedMarksheet = () => window.InstitutionAdminAnalytics?.export?.();
  window.printConsolidatedMarksheet = () => window.InstitutionAdminAnalytics?.print?.();
  window.renderConsolidatedMarksheet = () => window.InstitutionAdminAnalytics?.refresh?.();
  window.scrollToSection = id => document.getElementById(id)?.scrollIntoView({behavior:"smooth",block:"start"});
  window.filterAnalytics = window.filterAnalyticsTable = () => window.InstitutionAdminAnalytics?.refresh?.();
  window.updateAnalyticsMetric = () => window.InstitutionAdminAnalytics?.refresh?.();
  window.refreshAttendance = () => window.InstitutionAdminAttendance?.refresh?.();
  window.exportAllAttendance = () => window.InstitutionAdminAttendance?.export?.();
  window.resetAttendanceFilters = () => window.InstitutionAdminAttendance?.reset?.();
  window.filterAttendance = () => {};
  window.adminCheckIn = event => { if(event) event.preventDefault(); return false; };
  window.toggleAttendanceFields = () => {};
  window.exportTableToCSV = () => window.InstitutionAdminAttendance?.export?.();
  // These legacy controls are not allowed to run Super Admin-wide handlers in a tenant session.
  window.openStudentPublishModal = () => notify("Student result publication is managed in the institution's Published Marks module.");
  window.publishCurrentUnitMarks = () => notify("Use the institution's Published Marks module to release approved results.");
  window.showLecturerAssignmentModal = window.refreshAssignmentHistory = window.clearAllAssignments = window.resetUnitColumns = () =>
    notify("This legacy control is not enabled in the institution-scoped workflow yet.", true);
})();