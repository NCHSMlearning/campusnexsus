/* Campus Nexus — Institution Module Entitlement Guard
 * Reads the signed-in user's database entitlements and gates navigation/direct routes.
 * PostgreSQL RLS policies remain the authoritative data-access boundary.
 */
(() => {
  "use strict";
  if (window.__CN_MODULE_GUARD__) return;
  window.__CN_MODULE_GUARD__ = true;

  const client = () => window.sb || window.supabaseClient || window.supabase || null;
  const MODULES = [
    ["admin_exams", /admin exams|exam management|question bank|exam settings/i],
    ["proctoring", /proctor|invigilat|exam monitoring/i],
    ["examinations", /exam|assessment|marks entry/i],
    ["published_marks", /academic reports|published marks|grade report|marks statement|my results|results/i],
    ["learning_management", /learning|course|resource|lesson|assignment|classroom|lms/i],
    ["timetable", /timetable|class schedule/i],
    ["academic_management", /academic|programme|program|unit|curriculum/i],
    ["clinical_placements", /clinical|rotation|placement|logbook/i],
    ["student_welfare", /blog|welfare|counselling|student council/i],
    ["research_management", /research|thesis|proposal|dissertation/i],
    ["communication", /message|announcement|newsletter|communication|inbox/i],
    ["document_management", /document management|document vault|my documents/i],
    ["helpdesk", /support ticket|helpdesk|technical support/i],
    ["events", /calendar|event|important date/i],
    ["attendance", /attendance|check.?in|class register/i],
    ["finance", /finance|payment|fee|invoice|billing/i],
    ["human_resources", /human resource|staff management|payroll|leave|employee/i],
    ["admissions", /admission|applicant|application/i],
    ["transcripts_certificates", /transcript|certificate|graduation/i],
    ["analytics_reports", /analytic|report|performance|statistics/i],
    ["library", /library|book circulation/i],
    ["student_management", /student management|student records|learner records|enrolment/i],
    ["lecturer_portal", /lecturer portal|teaching staff/i],
    ["administrator_portal", /administrator portal|institution settings/i]
  ];

  const routeModule = (path) => {
    const p = String(path || "").toLowerCase();
    if (/\/platform\/student\.html$/.test(p)) return "student_portal";
    if (/\/platform\/lecturer\.html$/.test(p)) return "lecturer_portal";
    if (/\/platform\/admin\.html$/.test(p)) return "administrator_portal";
    if (/admin.?exams|exam.?dashboard|examinations\/source\/admin/.test(p)) return "admin_exams";
    if (/student.?exams|studentexam|examlogin/.test(p)) return "examinations";
    if (/lecturerexams/.test(p)) return "examinations";
    if (/proctor/.test(p)) return "proctoring";
    if (/resources|learning|lms|courseware/.test(p)) return "learning_management";
    if (/analytics|reports|performance-report/.test(p)) return "analytics_reports";
    if (/academic|curriculum|programme|program-management/.test(p)) return "academic_management";
    if (/attendance/.test(p)) return "attendance";
    if (/finance|payment|invoice/.test(p)) return "finance";
    if (/admission/.test(p)) return "admissions";
    if (/transcript|certificate|graduation/.test(p)) return "transcripts_certificates";
    if (/library/.test(p)) return "library";
    if (/staff|hrm|human-resource/.test(p)) return "human_resources";
    return null;
  };

  const moduleForElement = (el) => {
    const explicit = el.dataset.cnModule || el.dataset.module || el.getAttribute("data-module-key");
    if (explicit) return explicit;
    const tab = (el.dataset.tab || el.getAttribute("data-tab") || "").toLowerCase();
    const route = (el.getAttribute("href") || el.getAttribute("data-href") || "").toLowerCase();
    const value = tab + " " + route + " " + (el.textContent || "").trim();
    return MODULES.find(([, pattern]) => pattern.test(value))?.[0] || null;
  };

  function routeAllowed(moduleKey, enabled) {
    if (moduleKey === "student_portal") return enabled.has("student_management") || enabled.has("examinations") || enabled.has("learning_management");
    if (moduleKey === "lecturer_portal") return enabled.has("lecturer_portal") || enabled.has("admin_exams") || enabled.has("examinations") || enabled.has("learning_management");
    if (moduleKey === "administrator_portal") return enabled.has("administrator_portal");
    return enabled.has(moduleKey);
  }

  function showBlocked(moduleKey, errorMessage) {
    const old = document.getElementById("cn-module-access-block");
    if (old) old.remove();
    const overlay = document.createElement("main");
    overlay.id = "cn-module-access-block";
    overlay.setAttribute("role", "alert");
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483000;display:grid;place-items:center;padding:24px;background:#f1f5f9;font-family:Inter,Arial,sans-serif";
    const panel = document.createElement("section");
    panel.style.cssText = "width:min(520px,100%);padding:28px;border:1px solid #dbe3ed;border-radius:18px;background:#fff;box-shadow:0 18px 60px #0f172a18";
    const title = document.createElement("h1");
    title.textContent = errorMessage ? "Module access could not be verified" : "This module is not included";
    title.style.cssText = "margin:0 0 10px;color:#0f2f49;font-size:21px";
    const message = document.createElement("p");
    message.textContent = errorMessage || "Your institution has not enabled this module. Contact your institution administrator or Campus Nexus support to update its subscription.";
    message.style.cssText = "margin:0;color:#475569;line-height:1.65;font-size:14px";
    const link = document.createElement("a");
    link.href = "/platform/student.html";
    link.textContent = "Return to your portal";
    link.style.cssText = "display:inline-flex;margin-top:18px;padding:10px 15px;border-radius:10px;background:#0f766e;color:white;text-decoration:none;font-weight:700";
    panel.append(title,message,link);
    overlay.append(panel);
    document.body.append(overlay);
  }

  function applyNavigation(enabled) {
    const roots = [document.querySelector("#sidebar"), document.querySelector("#mainNav"), document.querySelector("#navMenu")].filter(Boolean);
    const seen = new Set();
    roots.forEach(root => root.querySelectorAll("a,button,[role='menuitem'],[data-tab]").forEach(item => {
      if (seen.has(item)) return;
      seen.add(item);
      const key = moduleForElement(item);
      if (!key) return;
      const allowed = enabled.has(key);
      item.hidden = !allowed;
      item.setAttribute("aria-hidden", allowed ? "false" : "true");
      item.dataset.cnEntitlementHidden = allowed ? "false" : "true";
      const tab = item.dataset.tab || item.getAttribute("data-tab");
      if (tab) {
        const pane = document.getElementById(tab);
        if (pane && pane.classList.contains("tab-content")) pane.hidden = !allowed;
      }
      const li = item.closest("li");
      if (li) li.hidden = !allowed;
    }));
    document.querySelectorAll(".nav-group,.menu-group,.menu-section").forEach(group => {
      const children = [...group.querySelectorAll("a,button,[role='menuitem'],[data-tab]")];
      if (children.length) group.hidden = children.every(el => el.hidden);
    });
    document.documentElement.dataset.cnModuleEntitlementsReady = "true";
  }

  async function start() {
    const sb = client();
    if (!sb?.auth?.getUser || !sb?.rpc || !sb?.from) return;
    const { data: auth, error: authError } = await sb.auth.getUser();
    if (authError || !auth?.user) return;
    const superadmin = await sb.rpc("is_current_user_superadmin");
    if (!superadmin.error && superadmin.data === true) {
      window.CampusNexusModules = { ready:true, isPlatformAdmin:true, enabled:new Set(["*"]), has:()=>true, require:()=>true };
      return;
    }
    // The student's authenticated profile is the tenant authority. Student accounts
    // are not necessarily rows in institution_users, so that table must never be
    // used as a reason to grant wildcard module access.
    const profileResult = await sb.from("consolidated_user_profiles_table")
      .select("institution_id,role,status,login_enabled")
      .eq("user_id", auth.user.id).maybeSingle();
    if (profileResult.error) {
      console.error("[Campus Nexus] Could not verify the signed-in user's institution:", profileResult.error);
      showBlocked(null, "Your institution could not be verified. Please sign in again or contact your institution administrator.");
      return;
    }
    const profile = profileResult.data;
    const profileInstitutionId = String(profile?.institution_id || "").trim();
    if (profileInstitutionId) {
      window.CURRENT_INSTITUTION_ID = profileInstitutionId;
      window.currentInstitutionId = profileInstitutionId;
      document.documentElement.dataset.institutionId = profileInstitutionId;
    }

    const memberships = await sb.from("institution_users").select("institution_id,status")
      .eq("user_id", auth.user.id).eq("status", "active");
    if (memberships.error) {
      console.error("[Campus Nexus] Could not verify institution membership:", memberships.error);
      showBlocked(null, "Your institution access could not be verified. Please reload or contact your institution administrator.");
      return;
    }
    if (!profileInstitutionId && !(memberships.data || []).length) {
      showBlocked(null, "This account is not linked to an institution. Contact your institution administrator.");
      return;
    }
    if (profile && String(profile.role || "").toLowerCase() === "student" && (!["approved", "active"].includes(String(profile.status || "").toLowerCase()) || profile.login_enabled === false)) {
      showBlocked(null, "Your student account is not currently approved for portal access.");
      return;
    }

    const entitlements = await sb.rpc("current_user_module_entitlements");
    if (entitlements.error || !Array.isArray(entitlements.data)) {
      console.error("[Campus Nexus] Module entitlement lookup failed:",entitlements.error);
      showBlocked(null,"Your institution's module access could not be verified. Please reload or contact the platform administrator.");
      return;
    }
    const enabled = new Set(entitlements.data.map(x => String(x).toLowerCase()));
    if (!enabled.size) {
      showBlocked(null, "Your institution has not enabled any portal modules for this account. Contact your institution administrator.");
      return;
    }
    enabled.delete("library"); // The library service is not yet implemented for tenant accounts.
    window.CampusNexusModules = {
      ready:true, legacy:false, enabled,
      has:key => enabled.has(String(key || "").toLowerCase()),
      require:key => enabled.has(String(key || "").toLowerCase())
    };
    applyNavigation(enabled);
    const required = routeModule(window.location.pathname);
    if (required && !routeAllowed(required,enabled)) {
      showBlocked(required);
      return;
    }
    // Catch navigation items inserted after the initial portal render.
    const nav = document.querySelector("#sidebar,#mainNav,#navMenu");
    if (nav && window.MutationObserver) {
      const observer = new MutationObserver(() => applyNavigation(enabled));
      observer.observe(nav,{childList:true,subtree:true});
      window.setTimeout(() => observer.disconnect(),30000);
    }
  }

  const boot = () => start().catch(error => {
    console.error("[Campus Nexus] Module entitlement guard failed:",error);
    const route = routeModule(window.location.pathname);
    if (route) showBlocked(route,"We could not verify this module's subscription. Access is paused until verification succeeds.");
  });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();
