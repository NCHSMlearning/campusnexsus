/* Campus Nexus — authenticated institution branding.
 * Student Portal consumes the institution record verified by student-auth-boot.js.
 * Never select a tenant from an untrusted URL or stale browser storage.
 */
(function () {
  "use strict";
  let applied = false;
  let attempts = 0;

  function client() {
    const candidates = [
      window.examSupabase,
      window.db && window.db.supabase,
      window.sb,
      window.supabaseClient,
      window.app && window.app.supabase
    ];
    return candidates.find(value =>
      value && typeof value.from === "function" &&
      value.auth && typeof value.auth.getUser === "function"
    ) || null;
  }

  function validColor(value, fallback) {
    const color = String(value || "").trim();
    if (/^#[0-9a-f]{3}$/i.test(color)) {
      return "#" + color.slice(1).split("").map(ch => ch + ch).join("");
    }
    return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
  }

  function palette(institution) {
    const defaults = ["#082f49", "#0f766e", "#d4a017", "#2563eb", "#7c3aed", "#db2777"];
    const source = institution.brand_colors;
    const named = source && !Array.isArray(source) && typeof source === "object" ? source : {};
    const values = Array.isArray(source) ? source : [
      named.primary, named.secondary,
      named.accent1 || named.accent || named.gold || named.tertiary,
      named.accent2, named.accent3, named.accent4
    ];
    return defaults.map((fallback, index) => {
      const legacy = index === 0 ? institution.primary_color :
        index === 1 ? institution.secondary_color : null;
      return validColor(values[index], validColor(legacy, fallback));
    });
  }

  function initials(name) {
    return String(name || "Institution").trim().split(/\s+/).filter(Boolean)
      .slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase() || "IN";
  }

  function fallbackLogo(name, primary, secondary) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">' +
      '<rect width="128" height="128" rx="24" fill="' + primary + '"/>' +
      '<circle cx="64" cy="64" r="53" fill="none" stroke="' + secondary + '" stroke-width="5"/>' +
      '<text x="64" y="76" text-anchor="middle" font-family="Arial" font-size="43" font-weight="700" fill="#fff">' +
      initials(name) + '</text></svg>';
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(element => {
      if (element !== document.documentElement && element !== document.body) {
        element.textContent = value;
      }
    });
  }

  function apply(institution) {
    if (!institution || !institution.id) return false;
    const path = String(location.pathname || "").toLowerCase();
    if (/superadmin/.test(path)) return false;

    const name = String(institution.name || "Your Institution").trim();
    const code = String(institution.school_code || institution.short_code || "").trim();
    const identity = code ? name + " (" + code + ")" : name;
    const pageKind = /lecturerexams/.test(path) ? "Lecturer Examination Workspace" :
      /adminexams|examinations\/source\/adminexams|admin\.html|examinations\/index/.test(path) ? "Examination Command Centre" :
      /institution-admin/.test(path) ? "Institution Administration" :
      /studentexam|student-exams/.test(path) ? "Student Examination Centre" :
      /exam\.html/.test(path) ? "Online Examination" : "Student Portal";
    const title = identity + " · " + pageKind;
    const colors = palette(institution);
    const primary = colors[0];
    const secondary = colors[1];
    const accent = colors[2];
    const logoUrl = String(institution.logo_url || "").trim();
    const logo = /^(https:\/\/|\/)/i.test(logoUrl) ? logoUrl :
      fallbackLogo(name, primary, secondary);

    const root = document.documentElement;
    root.dataset.institutionPortal = "true";
    root.dataset.institutionId = String(institution.id);
    root.dataset.institutionName = name;
    root.dataset.institutionCode = code;
    root.dataset.schoolCode = code;

    const variables = [
      ["--cn-institution-primary", primary],
      ["--cn-institution-secondary", secondary],
      ["--cn-institution-gold", accent],
      ["--nchsm-navy", primary],
      ["--nchsm-teal", secondary],
      ["--nchsm-gold", accent],
      ["--institution-primary", primary],
      ["--institution-secondary", secondary],
      ["--institution-gold", accent],
      ["--cn-brand-primary", primary],
      ["--cn-brand-secondary", secondary],
      ["--cn-brand-accent", accent]
    ];
    variables.forEach(([key, value]) => root.style.setProperty(key, value));
    colors.forEach((value, index) => root.style.setProperty("--cn-institution-color-" + (index + 1), value));

    document.title = title;
    document.querySelectorAll('meta[name="application-name"],meta[name="apple-mobile-web-app-title"]')
      .forEach(meta => { meta.content = title; });

    setText(".nchsm-header-title", name);
    setText(".nchsm-header-subtitle", pageKind + " • School Code: " + (code || "—"));
    if (document.querySelector(".sidebar-header .brand-text h2")) {
      setText(".sidebar-header .brand-text h2", name);
      const sidebarLabel = document.querySelector(".sidebar-header .brand-text>small");
      if (sidebarLabel) sidebarLabel.textContent = pageKind;
    }
    setText("#iaTenantName", name);
    setText("#iaSchoolCode", code ? "School code " + code : "Institution workspace");
    if (/lecturerexams/.test(path)) {
      setText(".command-brand-copy p", pageKind + " • " + name);
    }
    setText("#institution-name", name);
    setText("#institution-portal-label", "STUDENT PORTAL");
    setText("[data-institution-name]", name);
    setText("[data-institution-code]", code);

    const logoHosts = document.querySelectorAll(
      ".nchsm-header-logo,[data-institution-logo],#institutionLogo,.sidebar-header .brand-crest,#iaLogo,#iaSettingsBrandLogo"
    );
    logoHosts.forEach(host => {
      let image = host.matches("img") ? host : host.querySelector("img[data-cn-institution-logo]");
      if (!image) {
        host.replaceChildren();
        image = document.createElement("img");
        image.dataset.cnInstitutionLogo = "true";
        image.alt = name + " logo";
        image.style.cssText = "display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;border-radius:inherit";
        host.appendChild(image);
      }
      image.src = logo;
      image.alt = name + " logo";
      image.removeAttribute("srcset");
      image.style.objectFit = "contain";
      host.setAttribute("aria-label", name + " logo");
    });
    const logoTargets = new Set(document.querySelectorAll(
      ".nchsm-header-logo img,[data-institution-logo] img,#institutionLogo img,.sidebar-header .brand-crest img"
    ));
    document.querySelectorAll(".command-brand .command-cap,.command-brand .command-brand-icon").forEach(host => {
      let image = host.querySelector("img[data-cn-institution-logo]");
      if (!image) {
        host.replaceChildren();
        image = document.createElement("img");
        image.dataset.cnInstitutionLogo = "true";
        image.alt = name + " logo";
        image.style.cssText = "display:block;width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain;border-radius:inherit";
        host.appendChild(image);
      }
      logoTargets.add(image);
    });
    logoTargets.forEach(image => {
      image.src = logo;
      image.alt = name + " logo";
      image.removeAttribute("srcset");
      image.style.objectFit = "contain";
    });

    document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"]')
      .forEach(icon => { icon.href = logo; });

    const style = document.getElementById("cn-authenticated-institution-theme") ||
      document.createElement("style");
    style.id = "cn-authenticated-institution-theme";
    style.textContent =
      ":root{--cn-institution-primary:" + primary + ";--cn-institution-secondary:" + secondary +
      ";--cn-institution-gold:" + accent + ";--primary:" + primary + ";--secondary:" + secondary + "}" +
      "#sidebar,.sidebar,#iaApp #iaSidebar{background:linear-gradient(180deg," + primary + " 0%," + primary + " 70%," + secondary + " 130%)!important}" +
      "#iaApp #iaSidebar .ia-nav-item.active,#iaApp #iaSidebar .ia-nav-item:hover{background:" + accent + "!important;color:" + primary + "!important}" +
      "#iaApp #iaSidebar .ia-nav-item.active i,#iaApp #iaSidebar .ia-nav-item:hover i{color:" + primary + "!important}" +
      "#iaApp #iaSidebar .ia-institution-logo{display:flex!important;align-items:center!important;justify-content:center!important;background:#fff!important;border-color:" + accent + "!important;overflow:hidden!important}" +
      "#iaApp #iaSidebar .ia-institution-logo img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important}" +
      ".nchsm-header-title{color:" + primary + "!important}" +
      ".dashboard-hero,.welcome-banner,.welcome-card,.hero{background-image:linear-gradient(120deg," +
      primary + " 0%," + secondary + " 100%)!important;border-color:" + accent + "!important}" +
      ".btn-primary,.primary-button,.primary-btn{background:" + primary + "!important;border-color:" + primary + "!important}" +
      ".sidebar-header{box-sizing:border-box!important;min-height:82px!important;height:auto!important;padding:9px 12px!important;overflow:hidden!important}" +
      ".sidebar-header .sidebar-brand{display:flex!important;align-items:center!important;gap:10px!important;min-width:0!important;width:100%!important;overflow:hidden!important}" +
      ".sidebar-header .brand-crest{display:flex!important;flex:0 0 64px!important;width:64px!important;height:64px!important;min-width:64px!important;align-items:center!important;justify-content:center!important;padding:4px!important;box-sizing:border-box!important;border:1px solid " + accent + "!important;border-radius:12px!important;background:#fff!important;overflow:hidden!important}" +
      ".sidebar-header .brand-crest img{display:block!important;width:100%!important;height:100%!important;max-width:100%!important;max-height:100%!important;object-fit:contain!important}" +
      ".sidebar-header .brand-text{display:flex!important;flex:1 1 auto!important;flex-direction:column!important;min-width:0!important;max-width:100%!important;overflow:hidden!important}" +
      ".sidebar-header .brand-text h2{display:-webkit-box!important;max-width:100%!important;margin:0!important;overflow:hidden!important;font-size:clamp(12px,1vw,16px)!important;line-height:1.2!important;white-space:normal!important;overflow-wrap:anywhere!important;-webkit-box-orient:vertical!important;-webkit-line-clamp:2!important}" +
      ".sidebar-header .brand-text small{display:block!important;max-width:100%!important;overflow:hidden!important;font-size:9px!important;line-height:1.25!important;text-overflow:ellipsis!important;white-space:nowrap!important}" +
      ".command-topbar,.top-header.command-topbar{background:linear-gradient(110deg," + primary + "," + secondary + ")!important}" +
      ".command-brand .command-cap,.command-brand .command-brand-icon{display:flex!important;align-items:center!important;justify-content:center!important;flex:0 0 54px!important;width:54px!important;height:54px!important;padding:5px!important;box-sizing:border-box!important;border:1px solid " + accent + "!important;border-radius:12px!important;background:#fff!important;overflow:hidden!important}" +
      ".command-brand .command-cap img,.command-brand .command-brand-icon img{display:block!important;width:100%!important;height:100%!important;object-fit:contain!important}" +
      ".sidebar-menu a.active,.sidebar-menu a.active:hover,.sidebar-menu .active>a{background:" + accent + "!important;color:" + primary + "!important}" +
      ".sidebar-menu a.active i,.sidebar-menu .active>a i{color:" + primary + "!important}" +
      ".btn-primary,.primary-button,.primary-btn,.button-primary{background:" + primary + "!important;border-color:" + primary + "!important}" +
      ".command-welcome,.welcome-card,.command-welcome-card{border-color:" + accent + "!important}" +
      ".command-welcome .welcome-symbol,.command-welcome .welcome-icon{background:" + colors[2] + "!important;color:" + primary + "!important}" +
      ".command-brand-copy h1,.command-brand-copy p{color:#fff!important}" +
      ".command-brand-copy p{opacity:.9!important}" +
      ( /lecturerexams/.test(path) ?
        ".lecturer-dashboard-hero{background:linear-gradient(110deg," + primary + "," + secondary + ")!important;border-color:" + accent + "!important}" +
        ".lecturer-dashboard-hero h2,.lecturer-dashboard-hero p{color:#fff!important}" +
        ".lecturer-hero-tag{border-color:" + accent + "!important;color:" + primary + "!important}" +
        ".lecturer-hero-icon{background:" + accent + "!important;color:" + primary + "!important}" : "");
    /* Apply the institution palette to the complete workspace, not only its navigation. */
    style.textContent +=
      ":root{--cn-primary:"+primary+";--cn-secondary:"+secondary+";--cn-accent:"+accent+
      ";--cn-accent-1:"+colors[3]+";--cn-accent-2:"+colors[4]+";--cn-accent-3:"+colors[5]+
      ";--cn-page-bg:#f4f7fb;--cn-surface:#fff;--cn-text:#172b43;--cn-muted:#64748b;"+
      "--cn-border:color-mix(in srgb,"+primary+" 16%,#dbe4ee)}"+
      ":root{--cn-institution-color-1:"+colors[0]+";--cn-institution-color-2:"+colors[1]+
      ";--cn-institution-color-3:"+colors[2]+";--cn-institution-color-4:"+colors[3]+
      ";--cn-institution-color-5:"+colors[4]+";--cn-institution-color-6:"+colors[5]+
      ";--cn-page-bg:color-mix(in srgb,"+primary+" 3%,white);--cn-surface:#fff;--cn-text:#172b43;--cn-muted:#64748b}"+
      "body{color:var(--cn-text)}"+
      ".ia-sidebar,#iaApp #iaSidebar,.exam-sidebar,.sidebar,#sidebar{background:linear-gradient(180deg,"+primary+" 0%,"+primary+" 65%,"+secondary+" 115%)!important}"+
      ".ia-nav-item.active,.ia-nav-item:hover,.exam-nav a.active,.sidebar-menu a.active,.sidebar-menu .active>a{background:"+accent+"!important;color:"+primary+"!important}"+
      ".ia-nav-item.active i,.ia-nav-item:hover i,.exam-nav a.active i,.sidebar-menu a.active i{color:"+primary+"!important}"+
      ".ia-logo,.ia-institution-logo,.ia-profile-logo{border-color:"+accent+"!important;background:#fff!important;color:"+primary+"!important}"+
      ".ia-topbar,.command-topbar,.top-header{background:linear-gradient(110deg,"+primary+","+secondary+")!important;color:#fff!important}"+
      ".ia-content,.main-content,.dashboard-content,.page-content,.workspace-content{background:var(--cn-page-bg)!important;color:var(--cn-text)}"+
      ".ia-welcome,.ia-page-heading,.dashboard-welcome,.dashboard-hero,.welcome-banner,.welcome-card,.hero,.lecturer-dashboard-hero{background:linear-gradient(110deg,"+primary+","+secondary+")!important;border-color:"+accent+"!important;color:#fff!important}"+
      ".ia-welcome h1,.ia-page-heading h1,.dashboard-welcome h1,.dashboard-hero h1,.welcome-banner h1,.lecturer-dashboard-hero h2{color:#fff!important}"+
      ".ia-eyebrow,.ia-stat-card strong,.ia-panel-head h2,.ia-welcome h1,.ia-page-heading h1,.page-title h1,.section-title,.dashboard-title{--cn-heading-color:"+primary+"}"+
      ".ia-stat-card,.ia-panel,.ia-content-card,.stat-card,.metric-card,.dashboard-card,.content-card,.section-card,.panel,.card,.module-card,.quick-action-card,.widget-card{border-color:var(--cn-border)!important}"+
      ".ia-stat-icon,.stat-icon,.metric-icon,.card-icon,.section-icon{border-color:color-mix(in srgb,"+secondary+" 25%,white)!important}"+
      ".ia-primary-btn,.ia-primary-button,.btn-primary,.primary-button,.primary-btn,.button-primary,.submit-button,.action-primary{background:"+primary+"!important;border-color:"+primary+"!important;color:#fff!important}"+
      ".ia-secondary-btn,.btn-secondary,.secondary-button,.button-secondary,.outline-button{border-color:"+secondary+"!important;color:"+secondary+"!important}"+
      ".ia-text-btn,.ia-eyebrow,.section-eyebrow,.dashboard-eyebrow,.header-kicker{color:"+secondary+"}"+
      ".ia-table-panel th,thead th,.data-table thead th,.table thead th{background:color-mix(in srgb,"+primary+" 9%,white)!important;color:"+primary+"!important}"+
      "input:focus,select:focus,textarea:focus,.form-control:focus{border-color:"+secondary+"!important;box-shadow:0 0 0 3px color-mix(in srgb,"+secondary+" 18%,transparent)!important}"+
      "input[type=checkbox],input[type=radio],progress{accent-color:"+secondary+"}"+
      ".progress-bar,.progress-fill,.completion-fill{background:"+secondary+"!important}"+
      ".tab.active,.nav-tabs .active,.filter-chip.active,.segmented-control .active{color:"+primary+"!important;border-color:"+secondary+"!important}"+
      ".ia-logo img,.ia-profile-logo img{display:block;width:100%;height:100%;object-fit:contain}"+
      "body{color:var(--cn-text)}"+
      "main, .main-content, .content-wrapper, .dashboard-content, .page-content, .workspace-content{color:var(--cn-text)}"+
      "h1,h2,h3,h4,.page-title,.section-title,.dashboard-title,.card-title,.panel-title{color:"+primary+"}"+
      "p,.description,.subtitle,.helper-text,.text-muted,.muted{color:var(--cn-muted)}"+
      ".stat-card,.metric-card,.dashboard-card,.content-card,.section-card,.panel,.card,.module-card,.quick-action-card,.widget-card,.table-container,.chart-container{border-color:var(--cn-border)}"+
      ".stat-card,.metric-card,.dashboard-card,.content-card,.section-card,.panel,.card,.module-card,.quick-action-card,.widget-card{background-color:#fff}"+
      ".stat-card .icon,.metric-card .icon,.stat-icon,.metric-icon,.card-icon,.section-icon{background:color-mix(in srgb,"+secondary+" 12%,white);color:"+secondary+"}"+
      ".stat-card .value,.metric-card .value,.stat-value,.metric-value,.kpi-value{color:"+primary+"}"+
      ".section-heading,.section-header,.panel-heading,.card-header{border-color:var(--cn-border)}"+
      ".section-heading .icon,.section-header .icon,.panel-heading .icon{color:"+secondary+"}"+
      "a:not(.sidebar-menu a):not(.ia-nav-item){color:"+secondary+"}"+
      "button:not(.sidebar-menu button):not(.ia-nav-item),.btn,.button{accent-color:"+secondary+"}"+
      ".btn-primary,.primary-button,.primary-btn,.button-primary,.submit-button,.action-primary{background:"+primary+"!important;border-color:"+primary+"!important;color:#fff!important}"+
      ".btn-secondary,.secondary-button,.button-secondary,.outline-button{border-color:"+secondary+"!important;color:"+secondary+"!important}"+
      ".badge,.status-badge,.chip,.tag{border-color:color-mix(in srgb,"+accent+" 42%,white)}"+
      "thead th,.data-table thead th,.table thead th{background:color-mix(in srgb,"+primary+" 8%,white);color:"+primary+";border-color:var(--cn-border)}"+
      "table td,table th,.table td,.table th{border-color:var(--cn-border)}"+
      "input:focus,select:focus,textarea:focus,.form-control:focus{border-color:"+secondary+"!important;box-shadow:0 0 0 3px color-mix(in srgb,"+secondary+" 18%,transparent)!important;outline:none}"+
      "input[type=checkbox],input[type=radio],progress{accent-color:"+secondary+"}"+
      ".progress-bar,.progress-fill,.completion-fill{background:"+secondary+"}"+
      ".tab.active,.nav-tabs .active,.filter-chip.active,.segmented-control .active{color:"+primary+";border-color:"+secondary+";background:color-mix(in srgb,"+secondary+" 10%,white)}"+
      ".empty-state .icon,.empty-state i{color:"+secondary+"}"+
      "@media(prefers-reduced-motion:no-preference){.btn,.button,.card,.module-card{transition:border-color .18s ease,box-shadow .18s ease,background-color .18s ease}}";
    if (!style.parentNode) (document.head || document.documentElement).appendChild(style);

    document.querySelectorAll(".nchsm-pwa-install,[data-pwa-install],#installBtn,#installButton")
      .forEach(button => {
        if (/install/i.test(button.textContent || "")) {
          const icon = button.querySelector("i");
          const label = "Install " + name + " Portal";
          if (icon) button.replaceChildren(icon, document.createTextNode(" " + label));
          else button.textContent = label;
          button.setAttribute("aria-label", label);
        }
      });

    applied = true;
    window.CURRENT_INSTITUTION = institution;
    if (typeof window.__cnSubscribeInstitutionBranding === "function") {
      window.__cnSubscribeInstitutionBranding(String(institution.id));
    }
    window.CURRENT_INSTITUTION_ID = String(institution.id);
    window.CURRENT_INSTITUTION_CODE = code;
    window.CURRENT_SCHOOL_CODE = code;
    window.currentInstitutionCode = code;
    window.currentSchoolCode = code;
    document.dispatchEvent(new CustomEvent("campusnexus:institution-branding-applied", {
      detail: { institutionId: institution.id, name: name, schoolCode: code, logoUrl: institution.logo_url || null }
    }));
    console.info("[Campus Nexus] Student institution branding applied:", title);
    return true;
  }

  async function resolve(forceRefresh) {
    const authenticatedInstitution = window.CURRENT_INSTITUTION;
    if (!forceRefresh && authenticatedInstitution && authenticatedInstitution.id) {
      apply(authenticatedInstitution);
      return;
    }

    const supabase = client();
    if (!supabase) return;
    const auth = await supabase.auth.getUser();
    const user = auth && auth.data && auth.data.user;
    if (auth.error || !user) return;

    /* Lecturer Exams authenticates through examlogin.js and carries a verified,
       user-bound institution handoff into this tab. Prefer that same tenant
       context before falling back to the standard portal profile lookup. */
    if (/lecturerexams/.test(String(location.pathname || "").toLowerCase())) {
      let handoff = null;
      try {
        handoff = JSON.parse(sessionStorage.getItem("campusNexusExamLecturerAuth") ||
          localStorage.getItem("campusNexusExamLecturerAuth") || "null");
      } catch (_) {}
      if (handoff && handoff.user_id === user.id && handoff.institution_id) {
        const lecturerInstitution = await supabase.from("institutions")
          .select("id,name,short_code,school_code,logo_url,primary_color,secondary_color,brand_colors,status")
          .eq("id", handoff.institution_id).maybeSingle();
        if (lecturerInstitution.error) throw lecturerInstitution.error;
        if (lecturerInstitution.data &&
            String(lecturerInstitution.data.status || "").toLowerCase() !== "suspended") {
          apply(lecturerInstitution.data);
          return;
        }
      }
    }

    const profileResult = await supabase.from("consolidated_user_profiles_table")
      .select("institution_id,role").eq("user_id", user.id).maybeSingle();
    if (profileResult.error) throw profileResult.error;
    const profile = profileResult.data;
    if (!profile || !profile.institution_id) return;
    if (["superadmin", "super_admin", "platform_super_admin"].includes(String(profile.role || "").toLowerCase())) return;

    const institutionResult = await supabase.from("institutions")
      .select("id,name,short_code,school_code,logo_url,primary_color,secondary_color,brand_colors,physical_address,postal_address,status")
      .eq("id", profile.institution_id).maybeSingle();
    if (institutionResult.error) throw institutionResult.error;
    if (!institutionResult.data || String(institutionResult.data.status || "").toLowerCase() === "suspended") return;
    apply(institutionResult.data);
  }

  async function boot() {
    if (attempts++ >= 50 && !applied) return;
    try {
      await resolve();
    } catch (error) {
      console.warn("[Campus Nexus] Could not apply institution branding:", error && error.message || error);
    }
    if (!applied && attempts < 50) window.setTimeout(boot, 700);
  }

  let refreshInFlight = false;
  let brandingChannel = null;
  let subscribedInstitutionId = null;
  window.__cnSubscribeInstitutionBranding = function (institutionId) {
    const supabase = client();
    if (!supabase || typeof supabase.channel !== "function" ||
        subscribedInstitutionId === institutionId) return;
    if (brandingChannel && typeof supabase.removeChannel === "function") {
      try { supabase.removeChannel(brandingChannel); } catch (_) {}
    }
    subscribedInstitutionId = institutionId;
    try {
      brandingChannel = supabase.channel("cn-institution-branding-" + institutionId)
        .on("postgres_changes", {
          event: "UPDATE", schema: "public", table: "institutions",
          filter: "id=eq." + institutionId
        }, function () { refreshBranding(); })
        .subscribe();
    } catch (error) {
      console.warn("[Campus Nexus] Realtime branding subscription unavailable:", error && error.message || error);
    }
  };
  async function refreshBranding() {
    if (refreshInFlight) return;
    refreshInFlight = true;
    try { await resolve(true); }
    catch (error) { console.warn("[Campus Nexus] Institution branding refresh failed:", error && error.message || error); }
    finally { refreshInFlight = false; }
  }
  document.addEventListener("campusnexus:institution-updated", refreshBranding);
  document.addEventListener("campusnexus:institution-branding-changed", refreshBranding);
  window.addEventListener("focus", refreshBranding);
  window.addEventListener("pageshow", refreshBranding);
  window.addEventListener("storage", event => {
    if (!event.key || /institution|brand|school/i.test(event.key)) refreshBranding();
  });
  window.setInterval(refreshBranding, 30000);

  // student-auth-boot dispatches appReady on document, so listen there.
  document.addEventListener("appReady", boot);
  window.addEventListener("appReady", boot);
  window.addEventListener("load", boot);
  window.addEventListener("pageshow", boot);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();