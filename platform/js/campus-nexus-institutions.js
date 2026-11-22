/* Campus Nexus — Institution Management
 * Uses the existing authenticated Supabase client. Database RLS is authoritative.
 */
(() => {
  const MODULE_GROUPS = [
    ["Core portals", [
      ["student_management","Student portal","Student profiles, admissions records and academic history"],
      ["lecturer_portal","Lecturer portal","Staff teaching workspace, classes and assigned units"],
      ["administrator_portal","Institution administrator","Institution academic administration and oversight"]
    ]],
    ["Assessment management", [
      ["marks_entry","Marks entry","Institution-level marks register and academic score management"],
      ["marks_approval","Marks approval","Review and approve marks submitted by lecturers"],
      ["mark_entry_control","Mark entry control","Institution-level mark-entry windows and controls"],
      ["published_marks","Published marks","Review results released to institution students"]
    ]],
    ["Academic management", [
      ["academic_management","Academic management","Programmes, units, blocks, intakes and curriculum"],
      ["admissions","Admissions","Applications, selection, offers and student onboarding"],
      ["examinations","Examinations","Exam schedules, attempts, assessment and examination administration"],
      ["admin_exams","Exam administration","Exam creation, question banks, marking and results workflows"],
      ["proctoring","Online proctoring","Exam monitoring, integrity and proctoring logs"],
      ["transcripts_certificates","Transcripts & certificates","Academic results, transcripts and certificate issuance"],
      ["timetable","Timetabling & sessions","Class timetables, teaching schedules and room allocation"],
      ["clinical_placements","Clinical placements","Clinical sites, rotations, supervision and hours"],
      ["research_management","Research management","Research proposals, projects, reviews and submissions"],
      ["quality_assurance","Quality assurance","Audits, compliance, accreditation and action tracking"]
    ]],
    ["Student and campus services", [
      ["attendance","Attendance management","Student and staff attendance, sessions and reports"],
      ["student_welfare","Student welfare & discipline","Student support, counselling referrals and discipline records"],
      ["library","Library management","Library catalogue, circulation and digital resources"],
      ["hostel_management","Accommodation & hostels","Room allocation, occupancy and hostel services"],
      ["transport_management","Transport management","Vehicles, routes, schedules and transport requests"],
      ["career_services","Career services & alumni","Career support, placements and alumni engagement"],
      ["events","Events & calendar","Institution events, academic calendar and activities"]
    ]],
    ["Institution operations", [
      ["learning_management","Learning management system","Courses, lessons, learning resources and assignments"],
      ["human_resources","Human resources","Staff records, leave, contracts and workforce management"],
      ["finance","Finance & payments","Fees, invoices, payments, budgets and payroll entitlement"],
      ["inventory","Inventory & procurement","Stock, supplies, requisitions and procurement"],
      ["asset_management","Asset management","Institution equipment, maintenance and asset registers"],
      ["document_management","Records & document management","Institution records, approvals and document workflows"],
      ["communication","Communication & notifications","Announcements, messaging, email and notifications"],
      ["helpdesk","Helpdesk & support","Support requests, incidents and service tracking"]
    ]],
    ["Insights and reporting", [
      ["analytics_reports","Analytics & reports","Institution dashboards, performance indicators and reports"]
    ]]
  ];
  const MODULES = MODULE_GROUPS.flatMap(([, items]) => items);
  let sb, currentUser, editingId = null, institutions = [], selectedLogoFile = null;

  const $ = (id) => document.getElementById(id);
  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
  const safeWebUrl = (value, requireHttps = false) => {
    try {
      const url = new URL(String(value || "").trim());
      if (requireHttps ? url.protocol !== "https:" : !["https:","http:"].includes(url.protocol)) return "";
      return url.href;
    } catch (_) { return ""; }
  };
  const notify = (message, type = "info") => {
    if (typeof window.showNotification === "function") window.showNotification(message, type);
    else alert(message);
  };
  const setBusy = (busy) => {
    const button = $("cnInstitutionSave");
    if (button) { button.disabled = busy; button.textContent = busy ? "Saving…" : (editingId ? "Update institution" : "Add institution"); }
  };

  function bindReliableLogout() {
    if (window.__cnSuperAdminLogoutBound) return;
    window.__cnSuperAdminLogoutBound = true;
    document.addEventListener("click", async event => {
      const target = event.target?.closest?.(
        '#logoutBtn,#logoutButton,#logout,.logout a,.logout button,[data-action="logout"],[data-logout],a[href*="logout"],button[aria-label*="log out" i],button[title*="log out" i]'
      );
      if (!target) return;
      const label = (target.textContent || "").trim();
      const href = target.getAttribute("href") || "";
      if (!/logout|sign out/i.test(label + " " + href) && !target.hasAttribute("data-logout")) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (target.dataset.cnLoggingOut === "true") return;
      target.dataset.cnLoggingOut = "true";
      target.setAttribute("aria-busy","true");
      try {
        const client = window.sb || window.supabaseClient || window.supabase;
        if (!client?.auth?.signOut) throw new Error("Secure sign-out is unavailable. Please reload and try again.");
        const {error} = await client.auth.signOut({scope:"global"});
        if (error) throw error;
        ["userProfile","profileData","currentUser","campusnexus_admin","campusnexus_remember"].forEach(key => {
          try { localStorage.removeItem(key); sessionStorage.removeItem(key); } catch (_) {}
        });
        window.location.replace("/platform/login.html?logged_out=1");
      } catch (error) {
        console.error("[Campus Nexus] Logout failed:",error);
        notify(error.message || "Unable to sign out. Please try again.","error");
        target.dataset.cnLoggingOut = "false";
        target.removeAttribute("aria-busy");
      }
    }, true);
  }

  async function verifyPlatformAdmin() {
    sb = window.sb || window.supabase;
    if (!sb?.auth) throw new Error("The authenticated Supabase client is not available. Reload the page and sign in again.");
    const { data: authData, error: authError } = await sb.auth.getUser();
    if (authError || !authData?.user) throw new Error("Your secure session could not be verified. Please sign in again.");
    currentUser = authData.user;
    const { data: isPlatformAdmin, error } = await sb.rpc("is_current_user_superadmin");
    if (error) throw error;
    if (isPlatformAdmin !== true) {
      throw new Error("Access denied. Institution management is restricted to the central Campus Nexus Platform Super Admin.");
    }
  }

  function renderModuleOptions(selected = []) {
    const host = $("cnModuleOptions");
    if (!host) return;
    const examEnabled = ["examinations","admin_exams","proctoring"].some(key => selected.includes(key));
    const lmsEnabled = selected.includes("learning_management");
    host.innerHTML =
      '<style id="cn-module-inline-styles">' +
      '.cn-module-group{display:block;margin:16px 0 20px;padding:16px;border:1px solid #e2eaf0;border-radius:15px;background:linear-gradient(145deg,#fff 0%,#f8fbfd 100%);box-shadow:0 4px 14px rgba(8,47,73,.045)}' +
      '.cn-module-group-title{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:0 0 13px;padding-bottom:10px;border-bottom:1px solid #e8eef2;color:#082f49;font-size:13px;font-weight:800;letter-spacing:.01em}' +
      '.cn-module-group-title small{padding:4px 9px;border-radius:999px;background:#e8f3f4;color:#0f766e;font-size:10px;font-weight:800;white-space:nowrap}' +
      '.cn-module-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,245px),1fr));gap:10px}' +
      '.cn-module-option{position:relative;display:flex;align-items:flex-start;gap:11px;min-width:0;min-height:78px;padding:13px 42px 13px 13px;border:1px solid #dce6ec;border-radius:12px;background:#fff;cursor:pointer;transition:border-color .18s ease,background .18s ease,box-shadow .18s ease,transform .18s ease}' +
      '.cn-module-option:hover{border-color:#78aaa9;background:#fbffff;box-shadow:0 5px 14px rgba(8,47,73,.07);transform:translateY(-1px)}' +
      '.cn-module-option:has(input:checked){border-color:#0f766e;background:linear-gradient(135deg,#f0fdfa,#fff);box-shadow:0 0 0 2px rgba(15,118,110,.10)}' +
      '.cn-module-option input{width:18px;height:18px;flex:0 0 18px;margin:2px 0 0;accent-color:#0f766e;cursor:pointer}' +
      '.cn-module-copy{display:flex;flex-direction:column;gap:5px;min-width:0}' +
      '.cn-module-copy strong{color:#0f2f49;font-size:12px;font-weight:800;line-height:1.35}' +
      '.cn-module-copy small{color:#64748b;font-size:10.5px;font-weight:500;line-height:1.45}' +
      '.cn-module-check{position:absolute;right:12px;top:50%;width:23px;height:23px;display:grid;place-items:center;transform:translateY(-50%);border:1px solid #d9e3e9;border-radius:8px;background:#f8fafc;color:transparent;font-size:10px;transition:all .18s ease}' +
      '.cn-module-option:has(input:checked) .cn-module-check{border-color:#0f766e;background:#0f766e;color:#fff}' +
      '.cn-module-coming-soon{opacity:.62;cursor:not-allowed;filter:saturate(.65)}' +
      '.cn-module-coming-soon:hover{transform:none;box-shadow:none;border-color:#dce6ec;background:#fff}' +
      '.cn-module-coming-soon input{cursor:not-allowed}' +
      '@media(max-width:600px){.cn-module-group{padding:12px;margin:12px 0 16px}.cn-module-grid{grid-template-columns:minmax(0,1fr);gap:8px}.cn-module-option{min-height:72px;padding:12px 40px 12px 11px}}' +
      '</style>' +
      '<section class="cn-product-access"><div class="cn-product-access-heading"><strong>Choose the institution products</strong><small>These choices control which main workspace the institution can use. You can enable either product or both.</small></div><div class="cn-product-access-grid">' +
      '<label class="cn-product-choice"><input id="cnProductExam" type="checkbox" ' + (examEnabled ? "checked" : "") + '><span class="cn-product-choice-icon"><i class="fas fa-file-signature"></i></span><span><strong>Examination Dashboard</strong><small>Exam setup, student examination access, proctoring and exam administration</small></span></label>' +
      '<label class="cn-product-choice"><input id="cnProductLms" type="checkbox" ' + (lmsEnabled ? "checked" : "") + '><span class="cn-product-choice-icon"><i class="fas fa-book-open"></i></span><span><strong>Learning Management System (LMS)</strong><small>Courses, learning resources, lessons, assignments and classroom tools</small></span></label>' +
      '</div><p class="cn-product-access-note">Select Examination Dashboard for exam-only institutions. Select LMS for learning institutions. Both can be enabled when required.</p></section>' +
      MODULE_GROUPS.map(([group, items]) =>
        '<section class="cn-module-group"><div class="cn-module-group-title">' + esc(group) +
        '<small>' + items.length + ' options</small></div><div class="cn-module-grid">' +
        items.map(([key,label,description]) =>
          '<label class="cn-module-option"><input type="checkbox" name="cnModule" value="' + esc(key) + '"' +
          (selected.includes(key) ? " checked" : "") + '><span class="cn-module-copy"><strong>' + esc(label) +
          '</strong><small>' + esc(description) + '</small></span><span class="cn-module-check"><i class="fas fa-check"></i></span></label>'
        ).join("") + '</div></section>'
      ).join("");
    const updateCount = () => {
      const n = host.querySelectorAll('input[name="cnModule"]:checked').length;
      if ($("cnModuleCount")) $("cnModuleCount").textContent = n + " selected";
    };
    const syncProductChoices = () => {
      const keys = [...host.querySelectorAll('input[name="cnModule"]:checked')].map(input => input.value);
      $("cnProductExam").checked = ["examinations","admin_exams","proctoring"].some(key => keys.includes(key));
      $("cnProductLms").checked = keys.includes("learning_management");
      updateCount();
    };
    $("cnProductExam").addEventListener("change", event => {
      ["academic_management","examinations","admin_exams","proctoring"].forEach(key => {
        const input = host.querySelector('input[name="cnModule"][value="' + key + '"]');
        if (input) input.checked = event.target.checked;
      });
      updateCount();
    });
    $("cnProductLms").addEventListener("change", event => {
      const input = host.querySelector('input[name="cnModule"][value="learning_management"]');
      if (input) input.checked = event.target.checked;
      updateCount();
    });
    host.querySelectorAll('input[name="cnModule"]').forEach(input => input.addEventListener("change", syncProductChoices));
    updateCount();
  }
  function readBrandColors() {
    return ["cnInstitutionColor","cnInstitutionAccent","cnInstitutionColor3","cnInstitutionColor4","cnInstitutionColor5","cnInstitutionColor6"]
      .map(id => $(id)?.value).filter(Boolean);
  }
  function applyBrandColors(colors = []) {
    const ids = ["cnInstitutionColor","cnInstitutionAccent","cnInstitutionColor3","cnInstitutionColor4","cnInstitutionColor5","cnInstitutionColor6"];
    const defaults = ["#082f49","#0f766e","#d4a017","#2563eb","#7c3aed","#db2777"];
    ids.forEach((id,index) => { if ($(id)) $(id).value = colors[index] || defaults[index]; });
  }

  let institutionModal, institutionFormHome, institutionFormNext;
  function ensureInstitutionModal() {
    if (institutionModal) return;
    const form = $("cnInstitutionForm");
    if (!form) return;
    institutionFormHome = form.parentElement;
    institutionFormNext = form.nextSibling;
    institutionModal = document.createElement("div");
    institutionModal.id = "cnInstitutionEditModal";
    institutionModal.className = "cn-institution-modal";
    institutionModal.setAttribute("aria-hidden","true");
    institutionModal.innerHTML = `
      <style>
        .cn-module-coming-soon{opacity:.62;cursor:not-allowed;filter:saturate(.65)}
        .cn-module-coming-soon input{cursor:not-allowed}
        .cn-product-access{grid-column:1/-1;margin:0 0 18px;padding:17px;border:1px solid #cbdde8;border-radius:15px;background:linear-gradient(135deg,#f4fbff,#f2fbf8)}
        .cn-product-access-heading{display:flex;flex-direction:column;gap:5px;margin-bottom:13px}
        .cn-product-access-heading strong{font-size:14px;color:#0f2f49}
        .cn-product-access-heading small,.cn-product-access-note{font-size:11px;color:#64748b;line-height:1.5}
        .cn-product-access-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .cn-product-choice{display:flex;align-items:flex-start;gap:11px;padding:14px;border:1px solid #d5e2ea;border-radius:12px;background:#fff;cursor:pointer}
        .cn-product-choice:has(input:checked){border-color:#0f8b8d;box-shadow:0 0 0 2px #0f8b8d18;background:#f8ffff}
        .cn-product-choice input{width:18px;height:18px;accent-color:#0f766e;flex:0 0 auto;margin-top:2px}
        .cn-product-choice-icon{width:34px;height:34px;display:grid;place-items:center;border-radius:10px;background:#e7f4f4;color:#0f766e;flex:0 0 auto}
        .cn-product-choice>span:last-child{display:flex;flex-direction:column;gap:5px}
        .cn-product-choice strong{font-size:12px;color:#0f172a}
        .cn-product-choice small{font-size:11px;color:#64748b;line-height:1.45}
        .cn-product-access-note{margin:11px 0 0}
        .cn-product-badges{display:flex;flex-wrap:wrap;gap:5px;min-width:120px}
        .cn-product-badge{display:inline-flex;align-items:center;padding:5px 8px;border-radius:999px;font-size:10px;font-weight:800;white-space:nowrap}
        .cn-product-exam{background:#eaf2ff;color:#1d4ed8}
        .cn-product-lms{background:#e7f7ef;color:#047857}
        .cn-product-none{background:#f1f5f9;color:#64748b}
        @media(max-width:760px){.cn-product-access-grid{grid-template-columns:1fr}}
        .cn-institution-modal{position:fixed;inset:0;z-index:10050;display:none;align-items:center;justify-content:center;padding:clamp(10px,3vw,28px);background:rgba(8,20,38,.68);backdrop-filter:blur(5px)}
        .cn-institution-modal.is-open{display:flex}
        .cn-institution-dialog{width:min(980px,100%);max-height:90vh;display:flex;flex-direction:column;background:#fff;border-radius:20px;box-shadow:0 24px 80px rgba(0,0,0,.3);overflow:hidden}
        .cn-institution-modal-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 24px;background:linear-gradient(120deg,#082f49,#0f766e);color:#fff;flex:0 0 auto}
        .cn-institution-modal-head h2{margin:0;font-size:19px;font-weight:750;color:#fff}
        .cn-institution-modal-head p{margin:4px 0 0;color:rgba(255,255,255,.8);font-size:12px}
        .cn-institution-modal-close{width:38px;height:38px;border:1px solid rgba(255,255,255,.35);border-radius:11px;background:rgba(255,255,255,.12);color:#fff;font-size:23px;cursor:pointer}
        .cn-institution-modal-body{padding:22px 24px;overflow:auto;min-height:0}
        .cn-institution-modal-body #cnInstitutionForm{width:100%;max-width:780px;margin:0 auto;}
        .cn-institution-modal-body #cnInstitutionFormTitle{display:none}
        body.cn-modal-lock{overflow:hidden}
        @media(max-width:640px){.cn-institution-modal{padding:0;align-items:flex-end}.cn-institution-dialog{max-height:96vh;border-radius:18px 18px 0 0}.cn-institution-modal-head{padding:15px 17px}.cn-institution-modal-body{padding:16px}}
        .cn-school-mark img{display:block;width:100%;height:100%;object-fit:contain;background:#fff}

        /* Add Institution modal — refined Campus Nexus form system */
        .cn-institution-dialog{width:min(1120px,100%);max-height:min(92vh,980px);border:1px solid rgba(255,255,255,.5);border-radius:22px;background:#f7f9fc;box-shadow:0 28px 90px rgba(2,18,38,.38)}
        .cn-institution-modal-head{min-height:82px;padding:19px 28px;background:linear-gradient(112deg,#082f62 0%,#0b477d 68%,#0f766e 100%);position:relative}
        .cn-institution-modal-head:after{content:"";position:absolute;left:0;right:0;bottom:0;height:3px;background:linear-gradient(90deg,#d4a017,#f4c84a,transparent 78%)}
        .cn-institution-modal-head h2{font-size:21px;letter-spacing:-.025em}
        .cn-institution-modal-head p{font-size:12.5px}
        .cn-institution-modal-close{width:40px;height:40px;border-radius:12px;font-size:25px;transition:background .18s,transform .18s}
        .cn-institution-modal-close:hover{background:rgba(255,255,255,.24);transform:rotate(90deg)}
        .cn-institution-modal-body{padding:26px clamp(16px,3vw,34px) 30px;background:linear-gradient(180deg,#f8fbff 0%,#f3f7fb 100%)}
        .cn-institution-modal-body #cnInstitutionForm{max-width:100%;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px 18px;padding:24px;border:1px solid #e0e8f0;border-radius:19px;background:#fff;box-shadow:0 10px 32px rgba(8,47,73,.07)}
        .cn-institution-modal-body #cnInstitutionForm>*{min-width:0}
        .cn-institution-modal-body #cnInstitutionForm label{display:flex;flex-direction:column;gap:7px;color:#17324d;font-size:12px;font-weight:750;line-height:1.4}
        .cn-institution-modal-body #cnInstitutionForm input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=file]),
        .cn-institution-modal-body #cnInstitutionForm select,
        .cn-institution-modal-body #cnInstitutionForm textarea{width:100%;min-height:44px;padding:11px 13px;border:1px solid #d5e0eb;border-radius:10px;background:#fbfdff;color:#102b46;font:500 13px inherit;outline:none;transition:border-color .18s,box-shadow .18s,background .18s}
        .cn-institution-modal-body #cnInstitutionForm textarea{min-height:90px;resize:vertical}
        .cn-institution-modal-body #cnInstitutionForm input:focus,
        .cn-institution-modal-body #cnInstitutionForm select:focus,
        .cn-institution-modal-body #cnInstitutionForm textarea:focus{border-color:#2474b5;background:#fff;box-shadow:0 0 0 3px rgba(36,116,181,.12)}
        .cn-institution-modal-body #cnInstitutionForm input::placeholder,
        .cn-institution-modal-body #cnInstitutionForm textarea::placeholder{color:#91a1b2}
        .cn-institution-modal-body #cnInstitutionForm input[type=color]{width:46px;height:40px;padding:4px;border:1px solid #dbe4ed;border-radius:9px;background:#fff}
        .cn-institution-modal-body #cnInstitutionForm input[type=file]{width:100%;padding:10px;border:1px dashed #b9cbdc;border-radius:10px;background:#f8fbff;color:#50657a;font-size:12px}
        .cn-institution-modal-body #cnInstitutionForm input[type=checkbox],
        .cn-institution-modal-body #cnInstitutionForm input[type=radio]{accent-color:#0f766e}
        .cn-institution-modal-body #cnInstitutionForm fieldset{min-width:0;margin:0;padding:17px;border:1px solid #e0e8f0;border-radius:14px;background:#fbfdff}
        .cn-institution-modal-body #cnInstitutionForm legend{padding:0 8px;color:#0b477d;font-size:13px;font-weight:850}
        .cn-institution-modal-body #cnInstitutionForm hr{grid-column:1/-1;width:100%;border:0;border-top:1px solid #e8eef4;margin:4px 0}
        .cn-institution-modal-body #cnInstitutionForm [id*="Title"],
        .cn-institution-modal-body #cnInstitutionForm [class*="section-title"],
        .cn-institution-modal-body #cnInstitutionForm [class*="form-section"]{min-width:0}
        .cn-institution-modal-body #cnInstitutionForm #cnModuleOptions,
        .cn-institution-modal-body #cnInstitutionForm .cn-product-access,
        .cn-institution-modal-body #cnInstitutionForm .cn-module-group,
        .cn-institution-modal-body #cnInstitutionForm .cn-form-section,
        .cn-institution-modal-body #cnInstitutionForm .form-section,
        .cn-institution-modal-body #cnInstitutionForm .form-actions,
        .cn-institution-modal-body #cnInstitutionForm .cn-form-actions{grid-column:1/-1}
        .cn-institution-modal-body #cnInstitutionForm button{min-height:42px;padding:10px 17px;border:1px solid #d5e0eb;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer;transition:transform .16s,box-shadow .16s,background .16s}
        .cn-institution-modal-body #cnInstitutionForm button:hover{transform:translateY(-1px);box-shadow:0 5px 14px rgba(8,47,73,.12)}
        .cn-institution-modal-body #cnInstitutionSave{border-color:#0b3971;background:linear-gradient(120deg,#082f62,#0b477d);color:#fff}
        .cn-institution-modal-body #cnInstitutionCancel{background:#eef3f8;color:#29445f}
        .cn-institution-modal-body #cnInstitutionForm #cnInstitutionFormTitle{display:none}
        .cn-institution-modal-body #cnInstitutionForm .cn-product-access{border-color:#cbdde8;border-radius:15px;box-shadow:0 5px 18px rgba(8,47,73,.045)}
        .cn-institution-modal-body #cnInstitutionForm .cn-module-group{margin:0 0 12px;padding:15px}

        /* Correct the form's real DOM structure: section headings and field wrappers
           must span the form, while the inserted profile/admin/subscription panels
           manage their own internal columns. */
        .cn-institution-modal-body #cnInstitutionForm{
          display:grid;
          grid-template-columns:minmax(0,1fr);
          align-content:start;
          gap:12px;
          padding:clamp(15px,2.4vw,26px);
        }
        .cn-institution-modal-body #cnInstitutionForm>*,
        .cn-institution-modal-body #cnInstitutionForm>.form-group,
        .cn-institution-modal-body #cnInstitutionForm>.form-field,
        .cn-institution-modal-body #cnInstitutionForm>.field,
        .cn-institution-modal-body #cnInstitutionForm>.mb-3{
          grid-column:1/-1;
          width:100%;
          min-width:0;
        }
        .cn-institution-modal-body #cnInstitutionForm .form-group,
        .cn-institution-modal-body #cnInstitutionForm .form-field,
        .cn-institution-modal-body #cnInstitutionForm .field,
        .cn-institution-modal-body #cnInstitutionForm .mb-3{
          margin:0;
        }
        .cn-institution-modal-body #cnInstitutionForm .cn-institution-official-details,
        .cn-institution-modal-body #cnInstitutionForm .cn-admin-provisioning,
        .cn-institution-modal-body #cnInstitutionForm .cn-subscription-dates,
        .cn-institution-modal-body #cnInstitutionForm .cn-logo-studio,
        .cn-institution-modal-body #cnInstitutionForm #cnModuleOptions{
          grid-column:1/-1;
          width:100%;
          box-sizing:border-box;
        }
        .cn-institution-modal-head>div{min-width:0;flex:1 1 auto}
        .cn-institution-modal-head h2{max-width:100%;overflow-wrap:anywhere;line-height:1.25}
        .cn-institution-modal-head p{line-height:1.45}

        /* Final layout pass: eliminate the split heading/field columns visible
           in the institution editor and make each form section read top-to-bottom. */
        .cn-institution-modal-body #cnInstitutionForm{
          display:flex!important;
          flex-direction:column!important;
          align-items:stretch!important;
          gap:18px!important;
          padding:clamp(16px,2.8vw,32px)!important;
          background:#fff;
        }
        .cn-institution-modal-body #cnInstitutionForm>*{
          flex:0 0 auto;
          width:100%!important;
          max-width:100%!important;
          min-width:0!important;
          margin-left:0!important;
          margin-right:0!important;
        }
        .cn-institution-modal-body #cnInstitutionForm .form-section,
        .cn-institution-modal-body #cnInstitutionForm .form-grid,
        .cn-institution-modal-body #cnInstitutionForm .form-row,
        .cn-institution-modal-body #cnInstitutionForm .section-grid,
        .cn-institution-modal-body #cnInstitutionForm .institution-form-section{
          display:grid!important;
          grid-template-columns:minmax(0,1fr)!important;
          gap:12px!important;
          align-items:stretch!important;
        }
        .cn-institution-modal-body #cnInstitutionForm h2,
        .cn-institution-modal-body #cnInstitutionForm h3,
        .cn-institution-modal-body #cnInstitutionForm h4,
        .cn-institution-modal-body #cnInstitutionForm .section-heading{
          display:flex;
          align-items:center;
          gap:10px;
          width:100%;
          margin:0 0 2px!important;
          padding:0 0 11px!important;
          border-bottom:1px solid #e8eef4;
          color:#123b61!important;
          font-size:15px!important;
          font-weight:800!important;
          line-height:1.4;
        }
        .cn-institution-modal-body #cnInstitutionForm .form-group,
        .cn-institution-modal-body #cnInstitutionForm .form-field,
        .cn-institution-modal-body #cnInstitutionForm .field,
        .cn-institution-modal-body #cnInstitutionForm .mb-3{
          display:flex;
          flex-direction:column;
          align-items:stretch;
          gap:6px;
          width:100%;
          min-width:0;
        }
        .cn-institution-modal-body #cnInstitutionForm label{
          display:block!important;
          margin:0!important;
          color:#24435f!important;
          font-size:12px!important;
          font-weight:750!important;
        }
        .cn-institution-modal-body #cnInstitutionForm input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=file]),
        .cn-institution-modal-body #cnInstitutionForm select,
        .cn-institution-modal-body #cnInstitutionForm textarea{
          min-height:46px;
          border-radius:11px;
          background:#fbfdff;
          font-size:13px;
        }
        .cn-institution-modal-body #cnInstitutionForm .cn-institution-official-details,
        .cn-institution-modal-body #cnInstitutionForm .cn-admin-provisioning,
        .cn-institution-modal-body #cnInstitutionForm .cn-subscription-dates{
          display:grid!important;
          grid-template-columns:repeat(2,minmax(0,1fr))!important;
          gap:14px!important;
          padding:18px!important;
          margin:0!important;
          border:1px solid #e1eaf1;
          border-radius:15px;
          background:#f7fafc;
        }
        .cn-institution-modal-body #cnInstitutionForm .cn-subscription-dates{grid-template-columns:repeat(3,minmax(0,1fr))!important}
        .cn-institution-modal-body #cnInstitutionForm .cn-institution-official-details .wide,
        .cn-institution-modal-body #cnInstitutionForm .cn-admin-provisioning small{grid-column:1/-1}
        .cn-institution-modal-body #cnInstitutionForm .cn-logo-studio{
          margin:0!important;
          padding:18px!important;
          border-radius:15px;
        }
        .cn-institution-modal-body #cnInstitutionForm #cnModuleOptions{width:100%;min-width:0}
        .cn-institution-modal-body #cnInstitutionForm .cn-module-group{margin:0 0 13px!important}
        .cn-institution-modal-body #cnInstitutionSave{min-width:170px}
        .cn-institution-modal-body #cnInstitutionCancel{min-width:110px}

        .cn-wizard-shell{display:grid;grid-template-columns:260px minmax(0,1fr);min-height:610px;background:#fff;border:1px solid #e2eaf2;border-radius:17px;overflow:hidden;box-shadow:0 12px 38px rgba(8,47,73,.06)}
        .cn-wizard-sidebar{display:flex;flex-direction:column;gap:22px;padding:22px 17px;background:linear-gradient(180deg,#f2f7ff,#f7fbff);border-right:1px solid #e1eaf4}
        .cn-wizard-brand{display:flex;align-items:center;gap:10px;padding:0 4px 18px;border-bottom:1px solid #dce7f1;color:#082f62}
        .cn-wizard-cap{width:42px;height:42px;display:grid;place-items:center;border-radius:13px;background:#0b477d;color:#fff;font-size:20px}
        .cn-wizard-brand b{font-size:13px;letter-spacing:.02em}.cn-wizard-brand em{font-style:normal;color:#c28b0a}.cn-wizard-brand small{display:block;margin-top:3px;color:#64748b;font-size:9px}
        .cn-wizard-progress{height:5px;border-radius:99px;background:#dbe7f2;overflow:hidden}.cn-wizard-progress span{display:block;height:100%;width:16.6%;background:linear-gradient(90deg,#0b66c3,#0f8b8d);transition:width .2s}
        .cn-wizard-nav{display:grid;gap:8px}
        .cn-wizard-nav-item{display:flex;align-items:flex-start;gap:10px;width:100%;padding:10px 9px;border:1px solid transparent;border-radius:12px;background:transparent;text-align:left;color:#19334e;cursor:pointer}
        .cn-wizard-nav-item:hover{background:#eaf3ff}.cn-wizard-nav-item.is-active{background:#dcecff;border-color:#c5ddfb;color:#073b78}.cn-wizard-nav-item.is-complete .cn-wizard-number{background:#0f766e;color:#fff}
        .cn-wizard-number{width:28px;height:28px;flex:0 0 28px;display:grid;place-items:center;border-radius:50%;background:#b9cadd;color:#fff;font-size:12px;font-weight:800}
        .cn-wizard-nav-item.is-active .cn-wizard-number{background:#0865c5}
        .cn-wizard-nav-item b{display:block;font-size:11px;font-weight:850;line-height:1.35}.cn-wizard-nav-item small{display:block;margin-top:3px;color:#64748b;font-size:10px;line-height:1.35}
        .cn-wizard-campus{margin-top:auto;padding:18px 8px 8px;text-align:center;color:#0b5798}.cn-wizard-campus i{display:block;font-size:55px;margin-bottom:8px}.cn-wizard-campus small{color:#72849a;font-size:10px;line-height:1.5}
        .cn-wizard-main{display:flex;flex-direction:column;min-width:0;padding:20px 24px 16px}
        .cn-wizard-panel{flex:1;min-width:0}.cn-wizard-panel[hidden]{display:none!important}
        .cn-wizard-step-heading{display:flex;align-items:center;gap:13px;margin:0 0 18px;padding:13px 15px;border-radius:13px;background:linear-gradient(100deg,#eaf3ff,#f1f8ff)}
        .cn-wizard-step-icon{width:42px;height:42px;display:grid;place-items:center;border-radius:50%;background:#0d62b3;color:#fff;font-size:18px}
        .cn-wizard-step-heading b{display:block;color:#102b60;font-size:16px;font-weight:850}.cn-wizard-step-heading small{display:block;margin-top:3px;color:#526984;font-size:11px}
        .cn-wizard-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px 16px;align-content:start}
        .cn-wizard-fields>*{min-width:0}.cn-wizard-fields .form-group,.cn-wizard-fields .form-field,.cn-wizard-fields .field,.cn-wizard-fields .mb-3{margin:0!important}
        .cn-wizard-fields .cn-institution-official-details,.cn-wizard-fields .cn-admin-provisioning,.cn-wizard-fields .cn-subscription-dates,.cn-wizard-fields .cn-logo-studio,.cn-wizard-fields #cnModuleOptions{grid-column:1/-1}
        .cn-wizard-fields .cn-institution-official-details,.cn-wizard-fields .cn-admin-provisioning{grid-template-columns:repeat(2,minmax(0,1fr))}
        .cn-wizard-fields #cnModuleOptions{width:100%}
        .cn-wizard-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:22px;padding-top:16px;border-top:1px solid #e1eaf2}
        .cn-wizard-footer button{min-height:42px;padding:10px 16px;border:1px solid #d6e0eb;border-radius:10px;font-size:12px;font-weight:800;cursor:pointer}
        .cn-wizard-previous{background:#edf2f8;color:#50657b}.cn-wizard-previous:disabled{opacity:.4;cursor:not-allowed}
        .cn-wizard-footer-actions{display:flex;gap:10px}.cn-wizard-cancel{background:#fff;color:#17324d}.cn-wizard-next{border-color:#082f62!important;background:linear-gradient(120deg,#082f62,#0b477d);color:#fff}.cn-wizard-next.is-final{background:linear-gradient(120deg,#0f766e,#0b477d)}
        .cn-wizard-step-count{color:#73849a;font-size:10px;font-weight:750}
        .cn-wizard-fields input,.cn-wizard-fields select,.cn-wizard-fields textarea{max-width:100%}
        @media(max-width:900px){.cn-wizard-shell{grid-template-columns:205px minmax(0,1fr)}.cn-wizard-sidebar{padding:16px 11px}.cn-wizard-main{padding:16px}}
        @media(max-width:680px){.cn-wizard-shell{display:block;min-height:0}.cn-wizard-sidebar{padding:12px;gap:10px;border-right:0;border-bottom:1px solid #e1eaf4}.cn-wizard-brand,.cn-wizard-campus,.cn-wizard-progress{display:none}.cn-wizard-nav{display:flex;overflow-x:auto;gap:6px;padding-bottom:3px}.cn-wizard-nav-item{flex:0 0 auto;width:auto;max-width:155px;padding:8px}.cn-wizard-nav-item small{display:none}.cn-wizard-nav-item b{font-size:10px}.cn-wizard-number{width:24px;height:24px;flex-basis:24px}.cn-wizard-main{padding:13px}.cn-wizard-fields{grid-template-columns:minmax(0,1fr);gap:11px}.cn-wizard-footer{flex-wrap:wrap}.cn-wizard-step-count{order:3;width:100%;text-align:center}.cn-wizard-footer-actions{margin-left:auto}.cn-wizard-footer button{padding:9px 11px}}

        .cn-institution-modal-head{padding:20px clamp(18px,3vw,32px)!important}
        .cn-institution-modal-head h2{font-size:clamp(17px,2vw,22px)!important}
        .cn-institution-modal-body{padding:clamp(12px,2.4vw,28px)!important}
        @media(max-width:760px){
          .cn-institution-modal-body #cnInstitutionForm{gap:14px!important;padding:14px!important}
          .cn-institution-modal-body #cnInstitutionForm .cn-institution-official-details,
          .cn-institution-modal-body #cnInstitutionForm .cn-admin-provisioning,
          .cn-institution-modal-body #cnInstitutionForm .cn-subscription-dates{grid-template-columns:minmax(0,1fr)!important;padding:13px!important}
          .cn-institution-modal-body #cnInstitutionForm .cn-institution-official-details .wide,
          .cn-institution-modal-body #cnInstitutionForm .cn-admin-provisioning small{grid-column:auto}
          .cn-institution-modal-body #cnInstitutionForm .cn-logo-studio{grid-template-columns:minmax(0,1fr)!important;padding:13px!important}
        }

        @media(max-width:760px){
          .cn-institution-modal-head{align-items:flex-start}
          .cn-institution-modal-head h2{font-size:17px}
          .cn-institution-modal-body #cnInstitutionForm{grid-template-columns:minmax(0,1fr);gap:11px;padding:14px}
          .cn-institution-modal-body #cnInstitutionForm>*{grid-column:1/-1!important}
        }
        @media(max-width:760px){
          .cn-institution-modal{padding:0;align-items:flex-end}
          .cn-institution-dialog{width:100%;max-height:96vh;border-radius:19px 19px 0 0}
          .cn-institution-modal-head{padding:15px 18px}
          .cn-institution-modal-body{padding:13px}
          .cn-institution-modal-body #cnInstitutionForm{grid-template-columns:minmax(0,1fr);gap:13px;padding:16px}
          .cn-institution-modal-body #cnInstitutionForm>*{grid-column:1/-1}
        }

      </style>
      <section class="cn-institution-dialog" role="dialog" aria-modal="true" aria-labelledby="cnInstitutionModalHeading">
        <header class="cn-institution-modal-head"><div><h2 id="cnInstitutionModalHeading">Manage institution</h2><p>Update institution details, branding, access and enabled modules</p></div><button type="button" class="cn-institution-modal-close" aria-label="Close">&times;</button></header>
        <div class="cn-institution-modal-body" id="cnInstitutionModalBody"></div>
      </section>`;
    document.body.appendChild(institutionModal);
    const close = () => closeInstitutionModal();
    institutionModal.querySelector(".cn-institution-modal-close").addEventListener("click",close);
    institutionModal.addEventListener("click",e => { if (e.target === institutionModal) close(); });
    document.addEventListener("keydown",e => { if (e.key === "Escape" && institutionModal.classList.contains("is-open")) close(); });
    $("cnInstitutionModalBody").appendChild(form);
  }

  function setupInstitutionWizard() {
    const form = $("cnInstitutionForm");
    if (!form || form.dataset.cnWizardReady === "1") return;
    form.dataset.cnWizardReady = "1";
    form.noValidate = true;
    const steps = [
      {title:"Institution Profile",sub:"Core details & identification",icon:"fa-university",ids:["cnInstitutionName","cnInstitutionCode","cnInstitutionSlug","cnInstitutionType","cnInstitutionCountry","cnInstitutionCounty","cnInstitutionRegistrationNumber","cnInstitutionPhysicalAddress","cnInstitutionPostalAddress"]},
      {title:"Contact Details",sub:"Communication & address",icon:"fa-envelope",ids:["cnInstitutionEmail","cnInstitutionPhone","cnInstitutionWebsite"]},
      {title:"Branding & Portal",sub:"Logo, colours & portal setup",icon:"fa-pen-nib",ids:["cnInstitutionLogo","cnInstitutionLogoUpload","cnInstitutionDomain","cnInstitutionColor","cnInstitutionAccent","cnInstitutionColor3","cnInstitutionColor4","cnInstitutionColor5","cnInstitutionColor6","cnInstitutionPortalMode","cnInstitutionCustomLogin","cnInstitutionAdminPortal"]},
      {title:"Administrator Setup",sub:"Institution administrator account",icon:"fa-user",ids:["cnInstitutionAdmin","cnInstitutionAdminName","cnInstitutionAdminPhone","cnInstitutionAdminPassword","cnInstitutionAdminPasswordConfirm"]},
      {title:"Products & Permissions",sub:"Systems and module access",icon:"fa-file-alt",ids:["cnModuleOptions"]},
      {title:"Subscription & Activation",sub:"Plan, billing and status",icon:"fa-dollar-sign",ids:["cnInstitutionAmount","cnInstitutionPlan","cnInstitutionCycle","cnInstitutionSubscriptionStart","cnInstitutionSubscriptionEnd","cnInstitutionSubscriptionStatus","cnInstitutionStatus"]}
    ];
    const all = [...form.children];
    const shell = document.createElement("div");
    shell.className = "cn-wizard-shell";
    const side = document.createElement("aside");
    side.className = "cn-wizard-sidebar";
    side.innerHTML = '<div class="cn-wizard-brand"><span class="cn-wizard-cap"><i class="fas fa-graduation-cap"></i></span><span><b>CAMPUS <em>NEXUS</em></b><small>Smart Campus. Connected Future.</small></span></div><div class="cn-wizard-progress"><span id="cnWizardProgressFill"></span></div><nav class="cn-wizard-nav" aria-label="Institution setup steps"></nav><div class="cn-wizard-campus"><i class="fas fa-university"></i><small>One connected campus.<br>Everything in one place.</small></div>';
    const main = document.createElement("div");
    main.className = "cn-wizard-main";
    const panels = steps.map((step,index) => {
      const panel = document.createElement("section");
      panel.className = "cn-wizard-panel";
      panel.dataset.step = String(index);
      panel.hidden = index !== 0;
      panel.innerHTML = '<div class="cn-wizard-step-heading"><span class="cn-wizard-step-icon"><i class="fas '+step.icon+'"></i></span><span><b>'+step.title+'</b><small>'+step.sub+'</small></span></div><div class="cn-wizard-fields"></div>';
      main.appendChild(panel);
      const nav = document.createElement("button");
      nav.type = "button";
      nav.className = "cn-wizard-nav-item";
      nav.dataset.goStep = String(index);
      nav.innerHTML = '<span class="cn-wizard-number">'+(index+1)+'</span><span><b>'+step.title+'</b><small>'+step.sub+'</small></span>';
      side.querySelector(".cn-wizard-nav").appendChild(nav);
      return panel;
    });
    const footer = document.createElement("div");
    footer.className = "cn-wizard-footer";
    footer.innerHTML = '<button type="button" class="cn-wizard-previous" id="cnWizardPrevious"><i class="fas fa-arrow-left"></i> Previous</button><span class="cn-wizard-step-count" id="cnWizardStepCount">Step 1 of 6</span><div class="cn-wizard-footer-actions"><button type="button" class="cn-wizard-cancel" id="cnWizardCancel">Cancel</button><button type="button" class="cn-wizard-next" id="cnWizardNext">Save & Continue <i class="fas fa-arrow-right"></i></button></div>';
    main.appendChild(footer);
    const actions = all.filter(node => node.querySelector?.("#cnInstitutionSave,#cnInstitutionCancel") || ["cnInstitutionSave","cnInstitutionCancel"].includes(node.id));
    all.filter(node => !actions.includes(node)).forEach(node => {
      const ids = [node.id,...[...(node.querySelectorAll?.("[id]") || [])].map(el=>el.id)];
      let target = steps.findIndex(step => step.ids.some(id => ids.includes(id)));
      if (target < 0) target = 0;
      panels[target].querySelector(".cn-wizard-fields").appendChild(node);
    });
    actions.forEach(node => node.remove());
    form.replaceChildren(shell);
    shell.append(side,main);
    footer.querySelector("#cnWizardCancel").addEventListener("click",resetForm);
    let active = 0;
    const render = () => {
      panels.forEach((panel,i) => { panel.hidden = i !== active; });
      side.querySelectorAll(".cn-wizard-nav-item").forEach((button,i) => {
        button.classList.toggle("is-active",i===active);
        button.classList.toggle("is-complete",i<active);
        button.setAttribute("aria-current",i===active?"step":"false");
      });
      $("cnWizardProgressFill").style.width = ((active+1)/steps.length*100)+"%";
      $("cnWizardStepCount").textContent = "Step "+(active+1)+" of "+steps.length;
      $("cnWizardPrevious").disabled = active===0;
      $("cnWizardNext").innerHTML = active===steps.length-1 ? 'Save Institution <i class="fas fa-check"></i>' : 'Save & Continue <i class="fas fa-arrow-right"></i>';
      $("cnWizardNext").classList.toggle("is-final",active===steps.length-1);
      $("cnInstitutionModalBody").scrollTop = 0;
    };
    const validate = () => {
      const fields = [...panels[active].querySelectorAll("input,select,textarea")].filter(el=>!el.disabled && el.type!=="hidden" && el.required);
      const invalid = fields.find(el=>!el.checkValidity());
      if (invalid) { invalid.reportValidity(); invalid.focus(); return false; }
      if (active===0 && (!$("cnInstitutionName")?.value.trim() || !$("cnInstitutionCode")?.value.trim() || !$("cnInstitutionSlug")?.value.trim())) {
        notify("Complete the institution name, code and portal slug before continuing.","error"); return false;
      }
      if (active===3) {
        const pass=$("cnInstitutionAdminPassword")?.value||"", confirm=$("cnInstitutionAdminPasswordConfirm")?.value||"";
        if ((pass || confirm) && pass.length<10) { notify("The administrator password must contain at least 10 characters.","error"); return false; }
        if (pass!==confirm) { notify("The administrator passwords do not match.","error"); return false; }
      }
      if (active===4 && !$("cnProductExam")?.checked && !$("cnProductLms")?.checked) { notify("Select Examination Dashboard, LMS, or both.","error"); return false; }
      return true;
    };
    const go = next => {
      if (next>active && !validate()) return;
      if (next<0 || next>=steps.length) return;
      active=next; render();
    };
    side.querySelectorAll("[data-go-step]").forEach(button=>button.addEventListener("click",()=>go(Number(button.dataset.goStep))));
    $("cnWizardPrevious").addEventListener("click",()=>go(active-1));
    $("cnWizardNext").addEventListener("click",()=>{
      if (!validate()) return;
      if (active<steps.length-1) go(active+1);
      else {
        const save=$("cnInstitutionSave");
        if (save) save.click();
        else form.requestSubmit();
      }
    });
    render();
    form.dataset.cnWizardGo = String(active);
    form.addEventListener("cn:wizard-reset",()=>{active=0;render();});
  }

  function openInstitutionModal() {
    ensureInstitutionModal();
    if (!institutionModal) return;
    institutionModal.classList.add("is-open");
    institutionModal.setAttribute("aria-hidden","false");
    document.body.classList.add("cn-modal-lock");
    $("cnInstitutionModalHeading").textContent = "Manage " + ($("cnInstitutionName")?.value || "institution");
    $("cnInstitutionModalBody").scrollTop = 0;
  }
  function closeInstitutionModal() {
    if (!institutionModal) return;
    institutionModal.classList.remove("is-open");
    institutionModal.setAttribute("aria-hidden","true");
    document.body.classList.remove("cn-modal-lock");
    const form = $("cnInstitutionForm");
    if (form && institutionFormHome) institutionFormHome.insertBefore(form,institutionFormNext);
  }

  function setupLogoUploader() {
    const logoInput = $("cnInstitutionLogo");
    if (!logoInput || $("cnInstitutionLogoUpload")) return;
    const wrap = document.createElement("section");
    wrap.id = "cnInstitutionLogoUpload";
    wrap.className = "cn-logo-studio";
    wrap.innerHTML = `
      <style>
        .cn-logo-studio{margin:14px 0 20px;padding:18px;border:1px solid #d9e5ec;border-radius:16px;background:linear-gradient(145deg,#f8fbfd,#f3f8f8);display:grid;grid-template-columns:minmax(0,1.05fr) minmax(240px,.95fr);gap:20px;align-items:start}
        .cn-logo-studio *{box-sizing:border-box}
        .cn-logo-studio-head{grid-column:1/-1;display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
        .cn-logo-studio-head strong{display:block;color:#102f46;font-size:14px;font-weight:800}
        .cn-logo-studio-head small{display:block;margin-top:4px;color:#64748b;font-size:11px;line-height:1.5}
        .cn-logo-drop{min-width:0;padding:16px;border:1.5px dashed #9bb2c1;border-radius:14px;background:#fff}
        .cn-logo-drop label{display:block;margin-bottom:8px;color:#173b52;font-size:12px;font-weight:800}
        .cn-logo-drop input[type=file]{width:100%;max-width:100%;padding:10px;border:1px solid #dbe5eb;border-radius:9px;background:#f8fafc;font-size:12px}
        .cn-logo-drop-note{margin:9px 0 0;color:#718096;font-size:11px;line-height:1.5}
        .cn-logo-preview-panel{min-width:0;padding:14px;border:1px solid #dce6eb;border-radius:14px;background:#fff}
        .cn-logo-preview-label{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:10px;color:#173b52;font-size:11px;font-weight:800}
        .cn-logo-preview{width:100%;height:150px;display:grid;place-items:center;overflow:hidden;border:1px solid #e2e8f0;border-radius:12px;background:#fff;transition:background .15s ease}
        .cn-logo-preview img{display:block;max-width:100%;max-height:100%;width:100%;height:100%;object-fit:contain;padding:14px}
        .cn-logo-empty{display:flex;flex-direction:column;align-items:center;gap:8px;color:#94a3b8;font-size:11px}
        .cn-logo-empty i{font-size:28px}
        .cn-logo-customize{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:12px}
        .cn-logo-control{display:flex;flex-direction:column;gap:6px;min-width:0}
        .cn-logo-control label{font-size:10px;font-weight:800;color:#475569}
        .cn-logo-control select,.cn-logo-control input[type=color]{width:100%;min-height:36px;border:1px solid #d6e0e7;border-radius:8px;background:#fff;padding:5px 8px;color:#1e293b}
        .cn-logo-control input[type=color]{height:38px;padding:3px}
        .cn-logo-actions{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px}
        .cn-logo-clear{border:0;background:transparent;color:#b42318;font-size:11px;font-weight:700;cursor:pointer;padding:7px 0}
        .cn-logo-reset{border:1px solid #dbe5eb;border-radius:8px;background:#fff;color:#334155;font-size:11px;font-weight:700;padding:7px 10px;cursor:pointer}
        .cn-logo-status{color:#64748b;font-size:10px}
        @media(max-width:720px){.cn-logo-studio{grid-template-columns:1fr;padding:13px;gap:12px}.cn-logo-studio-head{grid-column:auto}.cn-logo-preview{height:130px}}
        /* Consistent, responsive alignment for every field in the institution editor */
        #cnInstitutionForm{display:grid;grid-template-columns:minmax(0,1fr);column-gap:0;row-gap:8px;align-content:start}
        #cnInstitutionForm>*{min-width:0}
        #cnInstitutionForm .form-group,#cnInstitutionForm .form-field,#cnInstitutionForm .field,#cnInstitutionForm .mb-3{min-width:0;width:100%;margin:0}
        #cnInstitutionForm label{display:block;margin:0 0 6px;color:#29465b;font-size:11px;font-weight:800;line-height:1.4}
        #cnInstitutionForm input:not([type=checkbox]):not([type=radio]),#cnInstitutionForm select,#cnInstitutionForm textarea{display:block;width:100%;max-width:100%;min-width:0;min-height:42px;box-sizing:border-box;border:1px solid #d4e0e7;border-radius:9px;padding:10px 12px;background:#fff;color:#102f46;font-size:13px;line-height:1.4;outline:none;transition:border-color .15s,box-shadow .15s}
        #cnInstitutionForm input:focus,#cnInstitutionForm select:focus,#cnInstitutionForm textarea:focus{border-color:#0f8b8d;box-shadow:0 0 0 3px rgba(15,139,141,.12)}
        #cnInstitutionForm textarea{min-height:88px;resize:vertical}
        #cnInstitutionForm .cn-logo-studio,#cnInstitutionForm #cnModuleOptions,#cnInstitutionForm .cn-product-access,#cnInstitutionForm .cn-admin-provisioning{grid-column:1/-1}
        #cnInstitutionForm button{max-width:100%}
        @media(max-width:640px){#cnInstitutionForm{grid-template-columns:minmax(0,1fr);gap:12px}#cnInstitutionForm>*{grid-column:1/-1!important}}
      </style>
      <div class="cn-logo-studio-head"><div><strong>Institution logo & identity</strong><small>Upload your logo, preview it instantly and adjust how it appears across Campus Nexus.</small></div><span class="cn-logo-status" id="cnLogoFileStatus">No new file selected</span></div>
      <div class="cn-logo-drop">
        <label for="cnInstitutionLogoFile">Choose logo file</label>
        <input id="cnInstitutionLogoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml">
        <p class="cn-logo-drop-note">PNG, JPG, WebP or SVG · Maximum 2 MB. Your current logo stays in place until you save the form.</p>
        <div class="cn-logo-actions"><button type="button" class="cn-logo-clear" id="cnInstitutionLogoClear">Remove logo</button><button type="button" class="cn-logo-reset" id="cnLogoStyleReset">Reset preview</button></div>
      </div>
      <div class="cn-logo-preview-panel">
        <div class="cn-logo-preview-label"><span>Live logo preview</span><span class="cn-logo-status">Preview only</span></div>
        <div class="cn-logo-preview" id="cnInstitutionLogoPreview"><div class="cn-logo-empty"><i class="fas fa-school"></i><span>Your logo will appear here</span></div></div>
        <div class="cn-logo-customize">
          <div class="cn-logo-control"><label for="cnLogoFit">Image fit</label><select id="cnLogoFit"><option value="contain">Show full logo</option><option value="cover">Fill preview</option></select></div>
          <div class="cn-logo-control"><label for="cnLogoBackground">Preview background</label><input id="cnLogoBackground" type="color" value="#ffffff"></div>
        </div>
      </div>`;
    const field = logoInput.closest(".form-group,.form-field,.field,.mb-3") || logoInput.parentElement;
    field.insertAdjacentElement("afterend", wrap);
    const preview = $("cnInstitutionLogoPreview");
    const fit = $("cnLogoFit");
    const background = $("cnLogoBackground");
    const renderPreview = src => {
      preview.style.background = background.value;
      preview.innerHTML = src ? '<img alt="Institution logo preview">' : '<div class="cn-logo-empty"><i class="fas fa-school"></i><span>Your logo will appear here</span></div>';
      if (src) {
        const img = preview.querySelector("img");
        img.src = src;
        img.style.objectFit = fit.value;
      }
    };
    const existing = safeWebUrl(logoInput.value,true);
    renderPreview(existing);
    fit.addEventListener("change",() => {
      const img = preview.querySelector("img");
      if (img) img.style.objectFit = fit.value;
    });
    background.addEventListener("input",() => { preview.style.background = background.value; });
    const logoFilePicker = $("cnInstitutionLogoFile");
    logoFilePicker.addEventListener("change",event => {
      const file = event.target.files && event.target.files[0] ? event.target.files[0] : null;
      if (!file) {
        selectedLogoFile = null;
        renderPreview(safeWebUrl(logoInput.value,true));
        $("cnLogoFileStatus").textContent = "No new file selected";
        return;
      }
      const extension = (file.name.split(".").pop() || "").toLowerCase();
      const detectedType = file.type || ({png:"image/png",jpg:"image/jpeg",jpeg:"image/jpeg",webp:"image/webp",svg:"image/svg+xml"}[extension] || "");
      if (!["image/png","image/jpeg","image/webp","image/svg+xml"].includes(detectedType)) {
        event.target.value = ""; selectedLogoFile = null;
        renderPreview(safeWebUrl(logoInput.value,true));
        notify("Choose a PNG, JPG, WebP or SVG image.","error");
        return;
      }
      if (file.size > 2*1024*1024) {
        event.target.value = ""; selectedLogoFile = null;
        renderPreview(safeWebUrl(logoInput.value,true));
        notify("The logo must be 2 MB or smaller.","error");
        return;
      }
      selectedLogoFile = file.type === detectedType ? file : new File([file],file.name,{type:detectedType,lastModified:file.lastModified});
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === "string" ? reader.result : "";
        if (!dataUrl) {
          $("cnLogoFileStatus").textContent = "Could not read this image. Please choose it again.";
          return;
        }
        renderPreview(dataUrl);
        const img = preview.querySelector("img");
        if (img) {
          img.onload = () => { $("cnLogoFileStatus").textContent = file.name + " · " + (file.size/1024).toFixed(0) + " KB · Preview ready"; };
          img.onerror = () => { $("cnLogoFileStatus").textContent = "Image preview failed. Try a PNG or JPG file."; };
        }
      };
      reader.onerror = () => { $("cnLogoFileStatus").textContent = "Could not read this image. Please choose it again."; };
      $("cnLogoFileStatus").textContent = "Loading preview…";
      reader.readAsDataURL(selectedLogoFile);
    });
    $("cnInstitutionLogoClear").addEventListener("click",() => {
      selectedLogoFile = null;
      $("cnInstitutionLogoFile").value = "";
      logoInput.value = "";
      $("cnLogoFileStatus").textContent = "Logo will be removed when saved";
      renderPreview("");
    });
    $("cnLogoStyleReset").addEventListener("click",() => {
      fit.value = "contain"; background.value = "#ffffff";
      renderPreview(selectedLogoFile ? URL.createObjectURL(selectedLogoFile) : safeWebUrl(logoInput.value,true));
    });
    logoInput.addEventListener("input",() => {
      if (!selectedLogoFile) renderPreview(safeWebUrl(logoInput.value,true));
    });
  }

  function syncLogoPreview() {
    const preview = $("cnInstitutionLogoPreview");
    if (!preview || selectedLogoFile) return;
    const url = safeWebUrl($("cnInstitutionLogo")?.value, true);
    preview.innerHTML = url ? '<img alt="Institution logo preview" src="' + esc(url) + '">' : '<i class="fas fa-school"></i>';
  }

  function setupSubscriptionFields() {
    const cycle = $("cnInstitutionCycle");
    if (!cycle || $("cnInstitutionSubscriptionDates")) return;
    const anchor = cycle.closest(".form-group,.form-field,.field,.mb-3") || cycle.parentElement;
    if (!anchor?.parentElement) return;
    const section = document.createElement("section");
    section.id = "cnInstitutionSubscriptionDates";
    section.className = "cn-subscription-dates";
    section.innerHTML = `
      <style>
        .cn-subscription-dates{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;padding:14px;margin:10px 0;border:1px solid #dbe6ec;border-radius:13px;background:#f8fbfd}
        .cn-subscription-dates .cn-sub-field{display:flex;flex-direction:column;gap:6px;min-width:0}
        .cn-subscription-dates label{font-size:11px;font-weight:800;color:#29465b}
        .cn-subscription-dates input,.cn-subscription-dates select{width:100%;min-width:0;box-sizing:border-box;min-height:42px;border:1px solid #d4e0e7;border-radius:9px;padding:10px 12px;background:#fff;color:#102f46;font:inherit}
        .cn-subscription-dates small{grid-column:1/-1;color:#64748b;font-size:10px;line-height:1.5}
        @media(max-width:640px){.cn-subscription-dates{grid-template-columns:1fr}}
      </style>
      <div class="cn-sub-field"><label for="cnInstitutionSubscriptionStart">Subscription start date</label><input id="cnInstitutionSubscriptionStart" type="date"></div>
      <div class="cn-sub-field"><label for="cnInstitutionSubscriptionEnd">Subscription end date</label><input id="cnInstitutionSubscriptionEnd" type="date"></div>
      <div class="cn-sub-field"><label for="cnInstitutionSubscriptionStatus">Subscription status</label><select id="cnInstitutionSubscriptionStatus"><option value="trial">Trial</option><option value="active">Active</option><option value="past_due">Past due</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select></div>
      <small>Optional start and end dates. Leave either date blank when the subscription has no fixed boundary.</small>`;
    anchor.insertAdjacentElement("afterend",section);
  }

  function setupInstitutionProfileFields() {
    const country = $("cnInstitutionCountry");
    if (!country || $("cnInstitutionOfficialDetails")) return;
    const anchor = country.closest(".form-group,.form-field,.field,.mb-3") || country.parentElement;
    if (!anchor?.parentElement) return;
    const section = document.createElement("section");
    section.id = "cnInstitutionOfficialDetails";
    section.className = "cn-institution-official-details";
    section.innerHTML = `
      <style>
        .cn-institution-official-details{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:15px;margin:10px 0;border:1px solid #dbe6ec;border-radius:13px;background:#f8fbfd}
        .cn-institution-official-details .cn-official-field{display:flex;flex-direction:column;gap:6px;min-width:0}
        .cn-institution-official-details .cn-official-field.wide{grid-column:1/-1}
        .cn-institution-official-details label{font-size:11px;font-weight:800;color:#29465b}
        .cn-institution-official-details input,.cn-institution-official-details textarea{width:100%;min-width:0;box-sizing:border-box;border:1px solid #d4e0e7;border-radius:9px;padding:10px 12px;background:#fff;color:#102f46;font:inherit}
        .cn-institution-official-details textarea{min-height:64px;resize:vertical}
        .cn-institution-official-details small{grid-column:1/-1;color:#64748b;font-size:10px;line-height:1.5}
        @media(max-width:640px){.cn-institution-official-details{grid-template-columns:1fr}.cn-institution-official-details .cn-official-field.wide{grid-column:auto}}
      </style>
      <div class="cn-official-field"><label for="cnInstitutionCounty">County / Region</label><input id="cnInstitutionCounty" type="text" maxlength="100" placeholder="e.g. Nakuru"></div>
      <div class="cn-official-field"><label for="cnInstitutionRegistrationNumber">Registration / Accreditation number</label><input id="cnInstitutionRegistrationNumber" type="text" maxlength="100" placeholder="Official institution registration number"></div>
      <div class="cn-official-field wide"><label for="cnInstitutionPhysicalAddress">Physical address</label><textarea id="cnInstitutionPhysicalAddress" maxlength="500" placeholder="Building, street, town and location"></textarea></div>
      <div class="cn-official-field wide"><label for="cnInstitutionPostalAddress">Postal address</label><textarea id="cnInstitutionPostalAddress" maxlength="300" placeholder="P.O. Box and postal code"></textarea></div>
      <small>These official details appear in the institution profile and can be updated later.</small>`;
    anchor.insertAdjacentElement("afterend", section);
  }

  function setupInstitutionAdminFields() {
    const email = $("cnInstitutionAdmin");
    if (!email) return;
    if ($("cnInstitutionAdminName")) {
      email.required = true;
      document.querySelectorAll("[data-toggle-password]").forEach(button => {
        if (button.dataset.bound) return;
        button.dataset.bound = "1";
        button.addEventListener("click", () => {
          const input = $(button.dataset.togglePassword);
          if (!input) return;
          input.type = input.type === "password" ? "text" : "password";
          button.textContent = input.type === "password" ? "Show" : "Hide";
        });
      });
      return;
    }
    const host = document.createElement("div");
    host.id = "cnInstitutionAdminProvisioning";
    host.className = "cn-admin-provisioning";
    host.innerHTML = `
      <style>
        .cn-admin-provisioning{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0;padding:16px;border:1px solid #cbdde8;border-radius:14px;background:linear-gradient(135deg,#f5fbff,#f0fbf7)}
        .cn-admin-provisioning .cn-admin-field{display:flex;flex-direction:column;gap:6px;min-width:0}
        .cn-admin-provisioning .cn-admin-field:first-child{grid-column:1/-1}
        .cn-admin-provisioning label{font-size:12px;font-weight:800;color:#12334a}
        .cn-admin-provisioning input{width:100%;min-height:42px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#0f172a}
        .cn-admin-provisioning small{grid-column:1/-1;color:#64748b;font-size:11px;line-height:1.5}
        .cn-admin-password-wrap{display:flex;gap:7px}.cn-admin-password-wrap input{flex:1;min-width:0}.cn-admin-password-wrap button{border:1px solid #cbd5e1;border-radius:9px;background:#fff;color:#12334a;padding:0 12px;font-weight:700;cursor:pointer}
        @media(max-width:600px){.cn-admin-provisioning{grid-template-columns:1fr}.cn-admin-provisioning .cn-admin-field:first-child{grid-column:auto}}
      </style>
      <div class="cn-admin-field"><label for="cnInstitutionAdminName">Administrator full name</label><input id="cnInstitutionAdminName" type="text" maxlength="120" autocomplete="name" placeholder="Required only when creating a new account"></div>
      <div class="cn-admin-field"><label for="cnInstitutionAdminPhone">Administrator phone number</label><input id="cnInstitutionAdminPhone" type="tel" maxlength="30" autocomplete="tel" placeholder="+254 7XX XXX XXX"></div>
      <div class="cn-admin-field"><label for="cnInstitutionAdminPassword">Initial password</label><div class="cn-admin-password-wrap"><input id="cnInstitutionAdminPassword" type="password" minlength="10" maxlength="72" autocomplete="new-password" placeholder="Optional — create a new account"><button type="button" data-toggle-password="cnInstitutionAdminPassword">Show</button></div></div>
      <div class="cn-admin-field"><label for="cnInstitutionAdminPasswordConfirm">Confirm new password</label><div class="cn-admin-password-wrap"><input id="cnInstitutionAdminPasswordConfirm" type="password" minlength="10" maxlength="72" autocomplete="new-password" placeholder="Re-enter password"><button type="button" data-toggle-password="cnInstitutionAdminPasswordConfirm">Show</button></div></div>
      <small>Enter only the administrator's email to assign an existing Campus Nexus account or allow the person to register and claim access. Enter a name and password as well only when creating a brand-new administrator account.</small>`;
    const field = email.closest(".form-group,.form-field,.field,.mb-3") || email.parentElement;
    field.insertAdjacentElement("afterend", host);
    const label = field.querySelector("label");
    if (label) label.textContent = "Administrator email address *";
    email.required = true;
    email.type = "email";
    email.autocomplete = "email";
    host.querySelectorAll("[data-toggle-password]").forEach(button => button.addEventListener("click", () => {
      const input = $(button.dataset.togglePassword);
      if (!input) return;
      input.type = input.type === "password" ? "text" : "password";
      button.textContent = input.type === "password" ? "Show" : "Hide";
    }));
  }

  function resetForm() {
    editingId = null;
    selectedLogoFile = null;
    if ($("cnInstitutionLogoFile")) $("cnInstitutionLogoFile").value = "";
    $("cnInstitutionForm")?.reset();
    if ($("cnInstitutionAdminPassword")) $("cnInstitutionAdminPassword").value = "";
    if ($("cnInstitutionAdminPasswordConfirm")) $("cnInstitutionAdminPasswordConfirm").value = "";
    if ($("cnInstitutionStatus")) $("cnInstitutionStatus").value = "pending";
    if ($("cnInstitutionType")) $("cnInstitutionType").value = "college";
    ["cnInstitutionCounty","cnInstitutionRegistrationNumber","cnInstitutionPhysicalAddress","cnInstitutionPostalAddress"].forEach(id => { if ($(id)) $(id).value = ""; });
    if ($("cnInstitutionAmount")) $("cnInstitutionAmount").value = "5000";
    if ($("cnInstitutionSubscriptionStart")) $("cnInstitutionSubscriptionStart").value = "";
    if ($("cnInstitutionSubscriptionEnd")) $("cnInstitutionSubscriptionEnd").value = "";
    if ($("cnInstitutionSubscriptionStatus")) $("cnInstitutionSubscriptionStatus").value = "active";
    applyBrandColors();
    if ($("cnInstitutionPortalMode")) $("cnInstitutionPortalMode").value = "campus_nexus";
    document.querySelectorAll('input[name="cnInstitutionPortalModeChoice"]').forEach(input => { input.checked = input.value === "campus_nexus"; });
    if ($("cnInstitutionCustomLogin")) $("cnInstitutionCustomLogin").value = "";
    if ($("cnInstitutionAdminPortal")) $("cnInstitutionAdminPortal").value = "";
    renderModuleOptions(["student_management","lecturer_portal","administrator_portal"]);
    syncLogoPreview();
    $("cnInstitutionSave").textContent = "Add institution";
    $("cnInstitutionFormTitle").textContent = "Register a new institution";
    $("cnInstitutionCancel").hidden = true;
    closeInstitutionModal();
    $("cnInstitutionForm")?.dispatchEvent(new Event("cn:wizard-reset"));
  }

  function fillForm(item) {
    editingId = item.id;
    const fields = {
      cnInstitutionName:item.name, cnInstitutionCode:item.short_code, cnInstitutionSlug:item.slug,
      cnInstitutionType:item.institution_type, cnInstitutionCountry:item.country,
      cnInstitutionCounty:item.county, cnInstitutionRegistrationNumber:item.registration_number,
      cnInstitutionPhysicalAddress:item.physical_address, cnInstitutionPostalAddress:item.postal_address,
      cnInstitutionEmail:item.contact_email, cnInstitutionPhone:item.contact_phone,
      cnInstitutionWebsite:item.website_url, cnInstitutionLogo:item.logo_url,
      cnInstitutionDomain:item.portal_domain, cnInstitutionAdmin:item.admin_email, cnInstitutionColor:item.primary_color,
      cnInstitutionAccent:item.secondary_color, cnInstitutionStatus:item.status,
      cnInstitutionPortalMode:item.portal_mode || "campus_nexus",
      cnInstitutionCustomLogin:item.custom_login_url,
      cnInstitutionAdminPortal:item.administrator_portal_url
    };
    Object.entries(fields).forEach(([id,value]) => { if ($(id)) $(id).value = value || ""; });
    applyBrandColors(item.brand_colors || [item.primary_color,item.secondary_color]);
    $("cnInstitutionAmount").value = item._subscription?.amount ?? 5000;
    $("cnInstitutionPlan").value = item._subscription?.plan_name || "Starter";
    $("cnInstitutionCycle").value = item._subscription?.billing_cycle || "monthly";
    $("cnInstitutionSubscriptionStart").value = item._subscription?.starts_at || "";
    $("cnInstitutionSubscriptionEnd").value = item._subscription?.ends_at || "";
    $("cnInstitutionSubscriptionStatus").value = item._subscription?.status || "active";
    $("cnInstitutionAdmin").value = item.admin_email || "";
    document.querySelectorAll('input[name="cnInstitutionPortalModeChoice"]').forEach(input => { input.checked = input.value === (item.portal_mode || "campus_nexus"); });
    $("cnInstitutionPortalMode")?.dispatchEvent(new Event("change"));
    selectedLogoFile = null;
    if ($("cnInstitutionLogoFile")) $("cnInstitutionLogoFile").value = "";
    renderModuleOptions(item._modules || []);
    syncLogoPreview();
    $("cnInstitutionSave").textContent = "Update institution";
    $("cnInstitutionFormTitle").textContent = "Edit institution";
    $("cnInstitutionCancel").hidden = false;
    openInstitutionModal();
  }

  function renderRows() {
    const host = $("cnInstitutionRows");
    if (!host) return;
    const query = ($("cnInstitutionSearch")?.value || "").trim().toLowerCase();
    const statusFilter = $("cnInstitutionFilter")?.value || "all";
    const filtered = institutions.filter(i =>
      (statusFilter === "all" || i.status === statusFilter) &&
      [i.name,i.short_code,i.slug,i.contact_email,i.admin_email,i.portal_domain]
        .some(v => String(v || "").toLowerCase().includes(query))
    );
    $("cnInstitutionCount").textContent = String(institutions.length);
    const navBadge = $("cnInstitutionNavBadge");
    if (navBadge) navBadge.textContent = String(institutions.length);
    $("cnInstitutionActive").textContent = String(institutions.filter(i => i.status === "active").length);
    $("cnInstitutionSuspended").textContent = String(institutions.filter(i => i.status === "suspended").length);
    if (!filtered.length) {
      host.innerHTML = '<tr><td colspan="7" class="cn-empty">No institutions match this search. Add an institution using the form.</td></tr>';
      return;
    }
    host.innerHTML = filtered.map(i => {
      const status = i.status === "active" ? "Active" : i.status === "suspended" ? "Suspended" : "Pending";
      const registrationUrl = safeWebUrl(i._registrationUrl);
      const portalUrl = safeWebUrl(i._portalUrl);
      const setupState = i.onboarding_status || "configuring";
      const adminState = i._adminUserId ? "Admin assigned" : "Admin pending";
      return '<tr><td><div class="cn-school"><span class="cn-school-mark" style="background:' + esc(i.primary_color || "#082f49") + '">' +
        (safeWebUrl(i.logo_url,true) ? '<img src="' + esc(safeWebUrl(i.logo_url,true)) + '" alt="" onerror="this.style.display=\'none\'">' : '<i class="fas fa-school"></i>') +
        '</span><span><strong>' + esc(i.name) + '</strong><small>' + esc(i.short_code) + ' · ' + esc(i.country || "") + (i.county ? ' · ' + esc(i.county) : '') + (i.registration_number ? ' · Reg: ' + esc(i.registration_number) : '') + ' · 3-digit school code: ' + esc(i.school_code || "Not assigned") + '</small>' +
        (i.school_code ? '<button class="cn-row-action" type="button" data-copy-school-code="' + esc(i.id) + '">Copy school code</button>' : '') +
        '<small>' + esc(adminState) + ' · ' + esc(setupState === "ready" ? "Onboarding complete" : "Onboarding in progress") + '</small>' +
        '</span></div></td>' +
        '<td><span class="cn-status cn-status-' + esc(i.status) + '">' + status + '</span></td>' +
        '<td>' + esc(i._subscription?.plan_name || "—") + '<small class="cn-subline">' +
        (i._subscription ? esc(i._subscription.currency) + " " + Number(i._subscription.amount).toLocaleString() + " / " + esc(i._subscription.billing_cycle) : "Not configured") + '</small></td>' +
        '<td><div class="cn-product-badges">' +
        ((i._modules || []).some(key => ["examinations","admin_exams","proctoring"].includes(key)) ? '<span class="cn-product-badge cn-product-exam">Exam Dashboard</span>' : '') +
        ((i._modules || []).includes("learning_management") ? '<span class="cn-product-badge cn-product-lms">LMS</span>' : '') +
        '<span class="cn-product-badge cn-product-none">' + (i._modules || []).length + ' modules enabled</span>' +
        (!((i._modules || []).some(key => ["examinations","admin_exams","proctoring"].includes(key)) || (i._modules || []).includes("learning_management")) ? '<span class="cn-product-badge cn-product-none">No product selected</span>' : '') +
        '</div></td>' +
        '<td>' + esc(i.contact_email || "—") + '</td><td>' + (portalUrl ? '<a href="' + esc(portalUrl) + '" target="_blank" rel="noopener">' + (i.portal_mode === "custom_website" ? "Open institution portal" : "Campus Nexus login") + '</a>' : 'Login portal not configured') +
        (registrationUrl ? '<br><a href="' + esc(registrationUrl) + '" target="_blank" rel="noopener">Registration</a><button class="cn-row-action" type="button" data-copy-registration="' + esc(i.id) + '">Copy</button>' : '') + '</td>' +
        '<td><div class="cn-row-actions"><button class="cn-row-action" type="button" data-edit="' + esc(i.id) + '">Manage</button>' +
        (i.status !== "active" ? '<button class="cn-row-action" type="button" data-status="' + esc(i.id) + '" data-next="active" aria-label="Activate ' + esc(i.name) + '">Activate</button>' :
        '<button class="cn-row-action cn-row-secondary" type="button" data-status="' + esc(i.id) + '" data-next="suspended" aria-label="Suspend ' + esc(i.name) + '">Suspend</button>') +
        '</div></td></tr>';
    }).join("");
    host.querySelectorAll("[data-copy-registration]").forEach(button => button.addEventListener("click", async () => {
      const item = institutions.find(i => i.id === button.dataset.copyRegistration);
      if (!item?._registrationUrl) return;
      try { await navigator.clipboard.writeText(item._registrationUrl); notify("Registration link copied.","success"); }
      catch (_) { notify(item._registrationUrl,"info"); }
    }));
    host.querySelectorAll("[data-copy-school-code]").forEach(button => button.addEventListener("click", async () => {
      const item = institutions.find(i => i.id === button.dataset.copySchoolCode);
      if (!item?.school_code) return;
      try { await navigator.clipboard.writeText(String(item.school_code)); notify("School code copied.","success"); }
      catch (_) { notify(String(item.school_code),"info"); }
    }));
    host.querySelectorAll("[data-edit]").forEach(button => button.addEventListener("click", () => {
      const item = institutions.find(i => i.id === button.dataset.edit);
      if (item) fillForm(item);
    }));
    host.querySelectorAll("[data-status]").forEach(button => button.addEventListener("click", async () => {
      const item = institutions.find(i => i.id === button.dataset.status);
      if (!item) return;
      const nextStatus = button.dataset.next;
      const verb = nextStatus === "suspended" ? "suspend" : "activate";
      if (!window.confirm("Are you sure you want to " + verb + " " + item.name + "?")) return;
      button.disabled = true;
      try {
        const {data:statusResult,error} = await sb.rpc("platform_set_institution_status",{
          p_institution_id:item.id,p_status:nextStatus
        });
        if (error) throw error;
        if (!statusResult?.institution_id) throw new Error("The status change was not confirmed by the server.");
        notify(item.name + " has been " + (nextStatus === "active" ? "activated." : "suspended."),"success");
        await loadInstitutions();
      } catch (error) {
        notify(error.message || "Unable to change institution status.","error");
        button.disabled = false;
      }
    }));
  }

  async function loadInstitutions() {
    const { data, error } = await sb.from("institutions").select("*").order("created_at", {ascending:false});
    if (error) throw error;
    const ids = (data || []).map(i => i.id);
    let modules = [], subscriptions = [], memberships = [], registrationLinks = [];
    if (ids.length) {
      const [m,s,u,l] = await Promise.all([
        sb.from("institution_modules").select("institution_id,module_key,enabled").in("institution_id",ids),
        sb.from("institution_subscriptions").select("id,institution_id,plan_name,amount,currency,billing_cycle,status,starts_at,ends_at").in("institution_id",ids).order("created_at",{ascending:false}),
        sb.from("institution_users").select("institution_id,user_id,role,status").in("institution_id",ids),
        sb.from("institution_registration_links").select("id,institution_id,code,is_active,expires_at").in("institution_id",ids).eq("is_active",true).order("created_at",{ascending:false})
      ]);
      if (m.error) throw m.error;
      if (s.error) throw s.error;
      if (u.error) throw u.error;
      if (l.error) throw l.error;
      modules = m.data || []; subscriptions = s.data || []; memberships = u.data || []; registrationLinks = l.data || [];
    }
    institutions = (data || []).map(i => {
      const sub = subscriptions.find(x => x.institution_id === i.id);
      const member = memberships.find(x => x.institution_id === i.id && x.status === "active" && x.role === "institution_admin");
      const registration = registrationLinks.find(x => x.institution_id === i.id);
      const schoolCode = String(i.school_code || "").trim();
      const hasSchoolCode = /^[0-9]{3}$/.test(schoolCode);
      const registrationUrl = i.portal_mode === "custom_website" ? "" :
        (hasSchoolCode ? "https://campusnexus.co.ke/register?school_code=" + encodeURIComponent(schoolCode) : "");
      const portalUrl = i.portal_mode === "custom_website" && i.custom_login_url
        ? i.custom_login_url
        : (hasSchoolCode
          ? "https://campusnexus.co.ke/login?school_code=" + encodeURIComponent(schoolCode)
          : "https://campusnexus.co.ke/login");
      return {...i, _modules:modules.filter(x => x.institution_id === i.id && x.enabled).map(x => x.module_key),
        _subscription:sub || null, _subscriptionId:sub?.id || null, _adminUserId:member?.user_id || null,
        _registrationUrl:registrationUrl, _portalUrl:portalUrl, _registrationCode:registration?.code || null};
    });
    renderRows();
  }

  async function saveInstitution(event) {
    event.preventDefault();
    const form = $("cnInstitutionForm");
    if (!form.reportValidity()) return;
    const name = $("cnInstitutionName").value.trim();
    const code = $("cnInstitutionCode").value.trim().toUpperCase();
    const slug = $("cnInstitutionSlug").value.trim().toLowerCase();
    if (!/^[A-Z0-9-]{2,12}$/.test(code)) return notify("Use 2–12 letters, numbers or hyphens for the institution code.", "error");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return notify("Use a URL-friendly slug (lowercase letters, numbers and hyphens).", "error");
    const adminEmail = $("cnInstitutionAdmin").value.trim().toLowerCase();
    const adminName = $("cnInstitutionAdminName")?.value.trim() || "";
    const adminPhone = $("cnInstitutionAdminPhone")?.value.trim() || "";
    const adminPassword = $("cnInstitutionAdminPassword")?.value || "";
    const adminPasswordConfirm = $("cnInstitutionAdminPasswordConfirm")?.value || "";
    if (!adminEmail) return notify("Enter the institution administrator email address.", "error");
    const creatingAdminAccount = Boolean(adminName || adminPassword || adminPasswordConfirm);
    if (creatingAdminAccount && !adminName) return notify("Enter the administrator's full name when creating a new account.", "error");
    if (creatingAdminAccount && adminPassword.length < 10) return notify("Set an initial administrator password with at least 10 characters.", "error");
    if (creatingAdminAccount && adminPassword !== adminPasswordConfirm) return notify("The administrator passwords do not match.", "error");
    const amount = Number($("cnInstitutionAmount").value);
    if (!Number.isFinite(amount) || amount < 0) return notify("Enter a valid subscription amount.", "error");
    const subscriptionStart = $("cnInstitutionSubscriptionStart")?.value || "";
    const subscriptionEnd = $("cnInstitutionSubscriptionEnd")?.value || "";
    if (subscriptionStart && subscriptionEnd && subscriptionEnd < subscriptionStart) return notify("The subscription end date cannot be earlier than its start date.", "error");
    const portalMode = document.querySelector('input[name="cnInstitutionPortalModeChoice"]:checked')?.value || "campus_nexus";
    $("cnInstitutionPortalMode").value = portalMode;
    const customLogin = $("cnInstitutionCustomLogin").value.trim();
    const website = $("cnInstitutionWebsite").value.trim();
    let logo = $("cnInstitutionLogo").value.trim();
    let uploadedLogoPath = null;
    const isHttpUrl = value => { try { const u = new URL(value); return ["http:","https:"].includes(u.protocol); } catch (_) { return false; } };
    if (portalMode === "custom_website" && (!isHttpUrl(customLogin) || !customLogin.startsWith("https://"))) {
      return notify("The custom login URL must be a valid HTTPS address.", "error");
    }
    if (website && !isHttpUrl(website)) return notify("Enter a valid website URL beginning with https:// or http://.", "error");
    if (logo && (!isHttpUrl(logo) || !logo.startsWith("https://"))) return notify("The institution logo URL must use HTTPS.", "error");
    const payload = {
      ...(editingId ? {id:editingId} : {}),
      name, short_code:code, slug, institution_type:$("cnInstitutionType").value,
      country:$("cnInstitutionCountry").value.trim() || "Kenya",
      county:$("cnInstitutionCounty")?.value.trim() || null,
      registration_number:$("cnInstitutionRegistrationNumber")?.value.trim() || null,
      physical_address:$("cnInstitutionPhysicalAddress")?.value.trim() || null,
      postal_address:$("cnInstitutionPostalAddress")?.value.trim() || null,
      contact_email:$("cnInstitutionEmail").value.trim() || null,
      contact_phone:$("cnInstitutionPhone").value.trim() || null,
      website_url:website || null, logo_url:logo || null,
      portal_domain:$("cnInstitutionDomain").value.trim() || null,
      primary_color:$("cnInstitutionColor").value,
      secondary_color:$("cnInstitutionAccent").value,
      brand_colors:readBrandColors(),
      portal_mode:portalMode,
      custom_login_url:portalMode === "custom_website" ? customLogin : null,
      administrator_portal_url:$("cnInstitutionAdminPortal").value.trim() || null,
      status:$("cnInstitutionStatus").value,
      subscription_starts_at:subscriptionStart || null,
      subscription_ends_at:subscriptionEnd || null,
      subscription_status:$("cnInstitutionSubscriptionStatus")?.value || "active"
    };
    const enabledModules = [...document.querySelectorAll('input[name="cnModule"]:checked')].map(x => x.value);
    const examSelected = $("cnProductExam")?.checked;
    const lmsSelected = $("cnProductLms")?.checked;
    if (!examSelected && !lmsSelected) return notify("Select at least one product: Examination Dashboard, LMS, or both.", "error");
    setBusy(true);
    try {
      if (selectedLogoFile) {
        const ext = ({ "image/png":"png", "image/jpeg":"jpg", "image/webp":"webp", "image/svg+xml":"svg" })[selectedLogoFile.type];
        if (!ext || selectedLogoFile.size > 2 * 1024 * 1024) throw new Error("Choose a supported logo image no larger than 2 MB.");
        uploadedLogoPath = (editingId || "new") + "/" + slug + "-" + Date.now() + "." + ext;
        const { error:uploadError } = await sb.storage.from("institution-logos").upload(uploadedLogoPath, selectedLogoFile, {
          cacheControl:"3600", upsert:false, contentType:selectedLogoFile.type
        });
        if (uploadError) throw uploadError;
        const { data:publicData } = sb.storage.from("institution-logos").getPublicUrl(uploadedLogoPath);
        logo = publicData?.publicUrl || "";
        if (!logo) throw new Error("Logo uploaded, but its public URL could not be generated.");
        $("cnInstitutionLogo").value = logo;
        payload.logo_url = logo;
      }
      const {data:result,error} = await sb.rpc("platform_save_institution",{
        p_payload:payload,
        p_modules:enabledModules,
        p_plan_name:$("cnInstitutionPlan").value,
        p_amount:amount,
        p_billing_cycle:$("cnInstitutionCycle").value,
        p_admin_email:adminEmail || (editingId ? institutions.find(item => item.id === editingId)?.admin_email : null) || null
      });
      if (error) throw error;
      const saved = result?.institution;
      if (!saved?.id || !result?.registration_code) {
        throw new Error("The server did not confirm the complete institution setup.");
      }
      if (adminEmail && adminName && adminPassword) {
        const {data:provisioned,error:provisionError} = await sb.functions.invoke("provision-institution-admin",{
          body:{institution_id:saved.id,email:adminEmail,full_name:adminName,phone:adminPhone,password:adminPassword}
        });
        let provisioningErrorMessage = provisioned?.error || "";
        if (provisionError) {
          provisioningErrorMessage = provisionError.message || "The administrator provisioning request failed.";
          try {
            const response = provisionError.context;
            if (response && typeof response.clone === "function") {
              const detail = await response.clone().json();
              provisioningErrorMessage = detail?.error || provisioningErrorMessage;
            }
          } catch (_) {}
        }
        if (provisionError || !provisioned?.success) {
          editingId = saved.id;
          $("cnInstitutionSave").textContent = "Retry administrator setup";
          await loadInstitutions();
          notify("Institution saved, but administrator account setup did not complete: " +
            (provisioningErrorMessage || "Please check the details and save again."),"error");
          return;
        }
      }
      const adminAssignment = result?.admin_assignment;
      const adminNotice = adminEmail && adminName && adminPassword
        ? " Administrator account created for " + adminEmail + "."
        : adminAssignment?.assigned
          ? " Existing administrator account assigned."
          : adminAssignment?.message
            ? " Administrator setup pending: " + adminAssignment.message
            : "";
      notify((editingId ? "Institution updated successfully." : "Institution created successfully.") + adminNotice,"success");
      resetForm();
      await loadInstitutions();
    } catch (error) {
      if (uploadedLogoPath) {
        try { await sb.storage.from("institution-logos").remove([uploadedLogoPath]); }
        catch (cleanupError) { console.warn("Could not clean up an unused institution logo:", cleanupError); }
      }
      console.error("Campus Nexus institution save failed:",error);
      notify(error.message || "Unable to save institution. No partial setup should have been committed.","error");
    } finally { setBusy(false); }
  }

  async function init() {
    const form = $("cnInstitutionForm");
    if (!form) return;
    bindReliableLogout();
    renderModuleOptions(["student_management","lecturer_portal","administrator_portal"]);
    setupLogoUploader();
    setupInstitutionAdminFields();
    setupInstitutionProfileFields();
    setupSubscriptionFields();
    ensureInstitutionModal();
    setupInstitutionWizard();
    $("cnInstitutionCancel").addEventListener("click",resetForm);
    $("cnInstitutionSearch").addEventListener("input",renderRows);
    $("cnInstitutionFilter").addEventListener("change",renderRows);
    $("cnInstitutionForm").addEventListener("submit",saveInstitution);
    $("cnInstitutionName").addEventListener("input",() => {
      if (editingId) return;
      const slug = $("cnInstitutionSlug");
      if (!slug.dataset.edited) slug.value = $("cnInstitutionName").value.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
      const code = $("cnInstitutionCode");
      if (!code.dataset.edited) code.value = $("cnInstitutionName").value.toUpperCase().replace(/[^A-Z0-9]+/g,"").slice(0,8);
    });
    $("cnInstitutionSlug").addEventListener("input",e => e.target.dataset.edited = "1");
    $("cnInstitutionCode").addEventListener("input",e => e.target.dataset.edited = "1");
    $("cnInstitutionRefresh").addEventListener("click",() => loadInstitutions().catch(e => notify(e.message,"error")));
    const syncPortalChoice = () => {
      const selected = document.querySelector('input[name="cnInstitutionPortalModeChoice"]:checked')?.value || "campus_nexus";
      $("cnInstitutionPortalMode").value = selected;
      const custom = selected === "custom_website";
      $("cnCustomLoginWrap")?.classList.toggle("is-visible", custom);
      if ($("cnInstitutionCustomLogin")) $("cnInstitutionCustomLogin").required = custom;
    };
    document.querySelectorAll('input[name="cnInstitutionPortalModeChoice"]').forEach(input => input.addEventListener("change", syncPortalChoice));
    $("cnInstitutionPortalMode")?.addEventListener("change", syncPortalChoice);
    syncPortalChoice();
    try {
      await verifyPlatformAdmin();
      await loadInstitutions();
    } catch (error) {
      console.error("Campus Nexus Institution Management:",error);
      $("cnInstitutionAccessError").hidden = false;
      $("cnInstitutionAccessError").textContent = error.message || "Unable to verify platform administrator access.";
      $("cnInstitutionForm").querySelectorAll("input,select,button").forEach(el => el.disabled = true);
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
