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

  // Route legacy page controls to the existing tenant-scoped Institution Admin modules.
  const openTenantView = key => {
    const nav = document.querySelector('[data-view="' + key + '"]');
    if (nav) nav.click();
    else notify("This institution workspace is not available.", true);
  };
  const csvFromTable = (bodyId, filename) => {
    const body = document.getElementById(bodyId);
    if (!body) return notify("There are no institution records to export yet.", true);
    const rows = [...body.closest("table").querySelectorAll("tr")].map(tr =>
      [...tr.children].map(td => '"' + (td.innerText || "").replace(/"/g, '""').replace(/\s+/g, " ").trim() + '"').join(",")
    );
    const blob = new Blob([rows.join("\r\n")], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href=url; a.download=filename; a.click(); URL.revokeObjectURL(url);
  };
  window.refreshStudentManagement = () => openTenantView("students");
  window.exportStudentRequests = () => csvFromTable("iaStudents","institution-students.csv");
  window.showSMSubTab = id => {
    const target = document.getElementById(id);
    if (!target) return;
    const root = document.getElementById("view-students");
    root?.querySelectorAll("[id^='sm'][role='tabpanel'],.sm-tab-panel").forEach(el=>el.hidden=true);
    target.hidden=false;
  };
  window.loadAdmissions = () => openTenantView("admissions");
  window.loadChangeProgramRequests = window.loadReadmissionRequests = window.loadSessionReportsAdmin = window.loadSMHistory = () =>
    notify("Student request workflows are not yet connected to this institution's request records.", true);
  window.bulkApproveSM = window.bulkRejectSM = window.bulkReviewSM =
  window.bulkApproveSessionReports = window.bulkRejectSessionReports = () =>
    notify("Bulk request decisions are disabled until institution-scoped request records are connected.", true);
  window.loadExams = () => openTenantView("exams");
  window.exportExamsToCSV = () => csvFromTable("iaExams","institution-examinations.csv");
  window.showExamTab = id => {
    const target=document.getElementById(id); if(!target)return;
    document.querySelectorAll("#view-exams [id$='Tab']").forEach(el=>el.hidden=true);
    target.hidden=false;
  };
  window.searchStudentsForNotification = () => notify("Student notification targeting is handled by the institution communication module.");
  window.refreshCalendarData = () => openTenantView("timetable");
  window.exportTimetableData = () => csvFromTable("iaTimetable","institution-timetable.csv");
  window.previewTimetable = () => notify("Timetable preview is available after selecting an institution schedule.");
  window.uploadTimetableToSupabase = window.clearTimetableBlock = window.downloadTimetableTemplate =
  window.showUploadMethod = window.addSingleEvent = window.createWeeklySchedule = () =>
    notify("Use the institution timetable records panel to manage schedules. Legacy platform-wide timetable actions are disabled.", true);
  window.refreshStudentDirectory = () => openTenantView("students");
  // These legacy controls are not allowed to run Super Admin-wide handlers in a tenant session.
  window.openStudentPublishModal = () => notify("Student result publication is managed in the institution's Published Marks module.");
  window.publishCurrentUnitMarks = () => notify("Use the institution's Published Marks module to release approved results.");
  window.showLecturerAssignmentModal = window.refreshAssignmentHistory = window.clearAllAssignments = window.resetUnitColumns = () =>
    notify("This legacy control is not enabled in the institution-scoped workflow yet.", true);
})();