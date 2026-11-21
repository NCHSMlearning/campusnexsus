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
        .cn-institution-dialog{width:min(1120px,100%);max-height:94vh;display:flex;flex-direction:column;background:#fff;border-radius:20px;box-shadow:0 24px 80px rgba(0,0,0,.3);overflow:hidden}
        .cn-institution-modal-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 24px;background:linear-gradient(120deg,#082f49,#0f766e);color:#fff;flex:0 0 auto}
        .cn-institution-modal-head h2{margin:0;font-size:19px;font-weight:750;color:#fff}
        .cn-institution-modal-head p{margin:4px 0 0;color:rgba(255,255,255,.8);font-size:12px}
        .cn-institution-modal-close{width:38px;height:38px;border:1px solid rgba(255,255,255,.35);border-radius:11px;background:rgba(255,255,255,.12);color:#fff;font-size:23px;cursor:pointer}
        .cn-institution-modal-body{padding:22px 24px;overflow:auto;min-height:0}
        .cn-institution-modal-body #cnInstitutionForm{width:100%;max-width:none;margin:0}
        .cn-institution-modal-body #cnInstitutionFormTitle{display:none}
        body.cn-modal-lock{overflow:hidden}
        @media(max-width:640px){.cn-institution-modal{padding:0;align-items:flex-end}.cn-institution-dialog{max-height:96vh;border-radius:18px 18px 0 0}.cn-institution-modal-head{padding:15px 17px}.cn-institution-modal-body{padding:16px}}
        .cn-school-mark img{display:block;width:100%;height:100%;object-fit:contain;background:#fff}
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
    const wrap = document.createElement("div");
    wrap.id = "cnInstitutionLogoUpload";
    wrap.className = "cn-logo-upload";
    wrap.innerHTML = `
      <style>
        .cn-logo-upload{margin-top:12px;padding:14px;border:1px dashed #94a3b8;border-radius:12px;background:#f8fafc}
        .cn-logo-upload-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap}
        .cn-logo-preview{width:76px;height:76px;display:grid;place-items:center;overflow:hidden;border:1px solid #cbd5e1;border-radius:12px;background:#fff;color:#64748b}
        .cn-logo-preview img{width:100%;height:100%;object-fit:contain}
        .cn-logo-upload-actions{display:flex;flex-direction:column;gap:7px;min-width:190px;flex:1}
        .cn-logo-upload-actions input{max-width:100%}
        .cn-logo-upload-note{font-size:12px;color:#64748b;margin:0}
        .cn-logo-clear{align-self:flex-start;border:0;background:transparent;color:#b91c1c;font-size:12px;cursor:pointer;padding:2px 0}
      </style>
      <div class="cn-logo-upload-row">
        <div class="cn-logo-preview" id="cnInstitutionLogoPreview"><i class="fas fa-school"></i></div>
        <div class="cn-logo-upload-actions">
          <label for="cnInstitutionLogoFile"><strong>Upload institution logo</strong></label>
          <input id="cnInstitutionLogoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml">
          <p class="cn-logo-upload-note">PNG, JPG, WebP or SVG · Maximum 2 MB. A preview appears before saving.</p>
          <button type="button" class="cn-logo-clear" id="cnInstitutionLogoClear">Clear selected logo</button>
        </div>
      </div>`;
    const field = logoInput.closest(".form-group,.form-field,.field, .mb-3") || logoInput.parentElement;
    field.insertAdjacentElement("afterend", wrap);
    const preview = $("cnInstitutionLogoPreview");
    const showPreview = src => {
      preview.innerHTML = src ? '<img alt="Institution logo preview">' : '<i class="fas fa-school"></i>';
      if (src) preview.querySelector("img").src = src;
    };
    const existing = safeWebUrl(logoInput.value, true);
    if (existing) showPreview(existing);
    $("cnInstitutionLogoFile").addEventListener("change", event => {
      const file = event.target.files?.[0] || null;
      if (!file) { selectedLogoFile = null; showPreview(safeWebUrl(logoInput.value, true)); return; }
      const allowed = ["image/png","image/jpeg","image/webp","image/svg+xml"];
      if (!allowed.includes(file.type)) {
        event.target.value = "";
        selectedLogoFile = null;
        notify("Choose a PNG, JPG, WebP or SVG image.", "error");
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        event.target.value = "";
        selectedLogoFile = null;
        notify("The logo must be 2 MB or smaller.", "error");
        return;
      }
      selectedLogoFile = file;
      showPreview(URL.createObjectURL(file));
    });
    $("cnInstitutionLogoClear").addEventListener("click", () => {
      selectedLogoFile = null;
      $("cnInstitutionLogoFile").value = "";
      logoInput.value = "";
      showPreview("");
    });
  }

  function syncLogoPreview() {
    const preview = $("cnInstitutionLogoPreview");
    if (!preview || selectedLogoFile) return;
    const url = safeWebUrl($("cnInstitutionLogo")?.value, true);
    preview.innerHTML = url ? '<img alt="Institution logo preview" src="' + esc(url) + '">' : '<i class="fas fa-school"></i>';
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
      <div class="cn-admin-field"><label for="cnInstitutionAdminName">Institution administrator full name *</label><input id="cnInstitutionAdminName" type="text" maxlength="120" autocomplete="name" placeholder="Enter administrator's full name"></div>
      <div class="cn-admin-field"><label for="cnInstitutionAdminPhone">Administrator phone number</label><input id="cnInstitutionAdminPhone" type="tel" maxlength="30" autocomplete="tel" placeholder="+254 7XX XXX XXX"></div>
      <div class="cn-admin-field"><label for="cnInstitutionAdminPassword">Initial password *</label><div class="cn-admin-password-wrap"><input id="cnInstitutionAdminPassword" type="password" minlength="10" maxlength="72" autocomplete="new-password" placeholder="At least 10 characters"><button type="button" data-toggle-password="cnInstitutionAdminPassword">Show</button></div></div>
      <div class="cn-admin-field"><label for="cnInstitutionAdminPasswordConfirm">Confirm password *</label><div class="cn-admin-password-wrap"><input id="cnInstitutionAdminPasswordConfirm" type="password" minlength="10" maxlength="72" autocomplete="new-password" placeholder="Re-enter password"><button type="button" data-toggle-password="cnInstitutionAdminPasswordConfirm">Show</button></div></div>
      <small>Set the first password for the institution administrator. The account is created securely in Supabase Auth and linked to this institution. Keep the password private and share it directly with the administrator.</small>`;
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
    if ($("cnInstitutionAmount")) $("cnInstitutionAmount").value = "5000";
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
  }

  function fillForm(item) {
    editingId = item.id;
    const fields = {
      cnInstitutionName:item.name, cnInstitutionCode:item.short_code, cnInstitutionSlug:item.slug,
      cnInstitutionType:item.institution_type, cnInstitutionCountry:item.country,
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
        '</span><span><strong>' + esc(i.name) + '</strong><small>' + esc(i.short_code) + ' · ' + esc(i.country || "") + ' · 3-digit school code: ' + esc(i.school_code || "Not assigned") + '</small>' +
        (i.school_code ? '<button class="cn-row-action" type="button" data-copy-school-code="' + esc(i.id) + '">Copy school code</button>' : '') +
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
    if (!adminEmail || (!editingId && !adminName)) return notify("Enter the institution administrator name and email address.", "error");
    if (!editingId && adminPassword.length < 10) return notify("Set an initial administrator password with at least 10 characters.", "error");
    if (!editingId && adminPassword !== adminPasswordConfirm) return notify("The administrator passwords do not match.", "error");
    if (adminPassword && adminPassword.length < 10) return notify("The administrator password must contain at least 10 characters.", "error");
    if (adminPassword && adminPassword !== adminPasswordConfirm) return notify("The administrator passwords do not match.", "error");
    const amount = Number($("cnInstitutionAmount").value);
    if (!Number.isFinite(amount) || amount < 0) return notify("Enter a valid subscription amount.", "error");
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
      status:$("cnInstitutionStatus").value
    };
    const enabledModules = [...document.querySelectorAll('input[name="cnModule"]:checked')].map(x => x.value).filter(key => key !== "library");
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
      notify((editingId ? "Institution updated successfully." : "Institution created successfully.") +
        (adminEmail && adminName && adminPassword ? " Administrator account created with the supplied initial password for " + adminEmail + "." : ""),"success");
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
    ensureInstitutionModal();
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
