/* Campus Nexus — institution-aware branding for authenticated tenant portals.
 * Resolves the signed-in user's institution and school code.
 * Platform Super Admin remains Campus Nexus branded.
 */
(function () {
  "use strict";
  const SUPABASE_URL = "https://irahplkvocaakjxuisto.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5Cg5FFudf03UnmOXGNGMHQ_uK9S-uQX";
  let applied = false;
  let attempts = 0;

  function getClient() {
    const candidates = [window.sb, window.supabaseClient, window.db && window.db.supabase,
      window.NCHSMLogin && window.NCHSMLogin.supabase];
    const existing = candidates.find(client => client && typeof client.from === "function" &&
      client.auth && typeof client.auth.getUser === "function");
    if (existing) return existing;
    if (window.supabase && typeof window.supabase.createClient === "function") {
      try {
        window.cnInstitutionBrandingClient = window.cnInstitutionBrandingClient ||
          window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
        return window.cnInstitutionBrandingClient;
      } catch (error) {
        console.warn("[Campus Nexus] Branding client initialization failed:", error);
      }
    }
    return null;
  }

  function safeColor(value, fallback) {
    if (typeof value !== "string") return fallback;
    const color = value.trim();
    if (/^#[0-9a-f]{3}$/i.test(color)) return "#" + color.slice(1).split("").map(ch => ch + ch).join("");
    return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
  }
  function institutionPalette(institution) {
    const defaults = ["#082f49","#0f766e","#d4a017","#2563eb","#7c3aed","#db2777"];
    const source = institution && institution.brand_colors;
    const named = source && !Array.isArray(source) && typeof source === "object" ? source : {};
    const values = Array.isArray(source) ? source : [named.primary,named.secondary,named.accent1||named.accent||named.gold||named.tertiary,named.accent2,named.accent3,named.accent4];
    return defaults.map((fallback,index)=>safeColor(index===0?(institution.primary_color||values[index]):index===1?(institution.secondary_color||values[index]):values[index],fallback));
  }
  function initials(value) {
    return String(value || "Institution").trim().split(/\s+/).filter(Boolean)
      .slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase() || "IN";
  }
  function fallbackLogo(name, primary, secondary) {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">' +
      '<rect width="128" height="128" rx="24" fill="' + primary + '"/>' +
      '<circle cx="64" cy="64" r="53" fill="none" stroke="' + secondary + '" stroke-width="5"/>' +
      '<text x="64" y="76" text-anchor="middle" font-family="Arial,sans-serif" font-size="43" font-weight="700" fill="#fff">' +
      initials(name) + '</text></svg>';
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }
  function pageRole() {
    const path = String(location.pathname || "").toLowerCase();
    if (/\/superadmin(?:login)?\.html$|\/platform\/superadmin/.test(path)) return "Platform";
    if (/exam_dashboard/.test(path)) return "Student Examination";
    if (/lecturerexams|\/lecturer(?:\.html)?$/.test(path)) return "Lecturer";
    if (/institution-admin|\/admin(?:\.html)?$|\/source\/admin(?:exams)?\.html$/.test(path)) return "Administrator";
    if (/exam|examination/.test(path)) return "Examinations";
    if (/student/.test(path)) return "Student";
    return "Institution";
  }
  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(el => {
      // Never replace the document root or body: tenant metadata selectors can
      // match <html> after institution data attributes are applied.
      if (el === document.documentElement || el === document.body) return;
      el.textContent = value;
    });
  }

  function applyBranding(institution) {
    if (applied || !institution || !institution.id) return;
    const role = pageRole();
    if (role === "Platform") return;

    const name = String(institution.name || "Your Institution").trim();
    const schoolCode = String(institution.school_code || institution.short_code || "").trim();
    const identity = schoolCode ? name + " (" + schoolCode + ")" : name;
    const roleLabel = role === "Institution" ? "Portal"
      : role === "Student Examination" ? "Student Examination Portal"
      : role === "Examinations" ? "Examination Portal" : role + " Portal";
    const title = identity + " " + roleLabel;
    const palette = institutionPalette(institution);
    const [primary, secondary, accent1, accent2, accent3, accent4] = palette;
    const gold = accent1;
    const logo = institution.logo_url && /^https:\/\//i.test(institution.logo_url)
      ? institution.logo_url : fallbackLogo(name, primary, secondary);

    const root = document.documentElement;
    root.dataset.institutionPortal = "true";
    root.dataset.institutionId = String(institution.id);
    root.dataset.institutionName = name;
    root.dataset.institutionCode = schoolCode;
    root.dataset.schoolCode = schoolCode;
    palette.forEach((color,index)=>root.style.setProperty("--cn-institution-color-"+(index+1),color));
    root.style.setProperty("--cn-institution-primary",primary);root.style.setProperty("--cn-institution-secondary",secondary);root.style.setProperty("--cn-institution-gold",gold);
    root.style.setProperty("--nchsm-navy",primary);root.style.setProperty("--nchsm-teal",secondary);root.style.setProperty("--nchsm-gold",gold);
    root.style.setProperty("--institution-primary",primary);root.style.setProperty("--institution-secondary",secondary);root.style.setProperty("--institution-gold",gold);
    root.style.setProperty("--cn-brand-primary",primary);root.style.setProperty("--cn-brand-secondary",secondary);root.style.setProperty("--cn-brand-accent",accent1);
    root.style.setProperty("--cn-brand-accent-2",accent2);root.style.setProperty("--cn-brand-accent-3",accent3);root.style.setProperty("--cn-brand-accent-4",accent4);

    // One consistent identity across tab, loading screen, app label and module headers.
    document.title = title;
    document.querySelectorAll('meta[name="application-name"],meta[name="apple-mobile-web-app-title"]').forEach(meta => {
      meta.content = title;
    });
    setText("#loading-screen .welcome-text h1", "Welcome to " + identity);
    setText("#loading-screen .subtitle", roleLabel);
    setText("[data-institution-name]", name);
    setText("[data-institution-code]", schoolCode);
    setText(".nchsm-header-title", name);
    setText(".nchsm-header-subtitle", roleLabel);
    setText(".lecturer-command-brand h1", title);
    setText(".lecturer-command-brand p", "Teaching, examinations, results and student monitoring");
    setText(".nrd-kicker", (identity + " " + roleLabel).toUpperCase());

    document.querySelectorAll(".brand-text h2").forEach(el => {
      const strong = document.createElement("strong");
      strong.className = "cn-institution-brand-name";
      strong.textContent = name;
      const code = document.createElement("small");
      code.className = "cn-institution-school-code";
      code.textContent = schoolCode ? "School Code: " + schoolCode : "";
      const portal = document.createElement("span");
      portal.className = "cn-institution-portal-role";
      portal.textContent = roleLabel;
      el.replaceChildren(strong, code, portal);
    });
    document.querySelectorAll(".sidebar-header h2").forEach(el => {
      if (/nchsm|campus nexus|institution/i.test(el.textContent || "")) el.textContent = name;
    });
    document.querySelectorAll(".sidebar-header").forEach(header => {
      let label = header.querySelector("[data-cn-institution-label]");
      if (!label) {
        label = document.createElement("small");
        label.dataset.cnInstitutionLabel = "true";
        header.appendChild(label);
      }
      label.textContent = schoolCode ? "School Code: " + schoolCode :
        (institution.physical_address || "Institution Portal");
    });

    const logoSelectors = [".sidebar-header img", ".brand-crest img", ".nchsm-header-logo",
      ".mobile-header .logo img", ".header-content .logo img", ".nchsm-loading-logo img",
      ".logo-animation img", ".logo-circle img", "[data-institution-logo]"];
    document.querySelectorAll(logoSelectors.join(",")).forEach(img => {
      img.src = logo;
      img.alt = name + " logo";
      img.removeAttribute("srcset");
      img.style.objectFit = "contain";
    });
    document.querySelectorAll(".logo-circle").forEach(el => {
      if (el.querySelector("img")) return;
      const img = document.createElement("img");
      img.src = logo;
      img.alt = name + " logo";
      img.style.cssText = "width:100%;height:100%;object-fit:contain;border-radius:inherit";
      el.replaceChildren(img);
    });
    document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"]').forEach(link => {
      link.href = logo;
    });

    let theme = document.getElementById("cn-authenticated-institution-theme");
    if (!theme) {
      theme = document.createElement("style");
      theme.id = "cn-authenticated-institution-theme";
      const styleHost = document.head || document.documentElement;
      if (!styleHost) return;
      styleHost.appendChild(theme);
    }
    theme.textContent = [
      ":root{--cn-institution-primary:",primary,";--cn-institution-secondary:",secondary,";--cn-institution-gold:",gold,
      ";--cn-institution-color-1:",primary,";--cn-institution-color-2:",secondary,";--cn-institution-color-3:",accent1,
      ";--cn-institution-color-4:",accent2,";--cn-institution-color-5:",accent3,";--cn-institution-color-6:",accent4,
      ";--nchsm-navy:",primary,";--nchsm-teal:",secondary,";--nchsm-gold:",gold,
      ";--institution-primary:",primary,";--institution-secondary:",secondary,";--institution-gold:",gold,
      ";--cn-brand-primary:",primary,";--cn-brand-secondary:",secondary,";--cn-brand-accent:",accent1,
      ";--cn-brand-accent-2:",accent2,";--cn-brand-accent-3:",accent3,";--cn-brand-accent-4:",accent4,"}",
      "#sidebar,.sidebar{background-color:",primary,"!important;background-image:linear-gradient(180deg,",primary,",",primary," 68%,",secondary,")!important}",
      ".sidebar-header,.sidebar-brand,.nchsm-header-brand{border-color:",secondary,"55!important}",
      ".sidebar-header img,.brand-crest img,.nchsm-header-logo,.mobile-header .logo img,.header-content .logo img,.nchsm-loading-logo img{object-fit:contain!important}",
      ".sidebar a.active,.sidebar-menu a.active,#sidebar .nav a.active{border-left-color:",gold,"!important}",
      ".nchsm-header-title,.brand-text .cn-institution-brand-name{color:",primary,"!important}",
      ".nchsm-header-subtitle{color:",secondary,"!important}",
      ".cn-institution-school-code{display:block;font-size:11px;font-weight:600;opacity:.85}",
      ".cn-institution-portal-role{display:block;font-size:12px;font-weight:500}",
      ".admin-badge{border-color:",gold,"66!important}",
      ".btn-primary,.primary-button,.primary-btn,.ia-primary-btn,.submit,.login-button{background:linear-gradient(135deg,",secondary,",",primary,")!important;border-color:",primary,"!important}",
      ".btn-secondary,.secondary-button,.ia-secondary-btn{border-color:",accent2,"!important;color:",primary,"!important}",
      ".nav-link.active,.nav-item.active,.tab-button.active,[aria-current=page]{border-color:",accent1,"!important;box-shadow:inset 3px 0 ",accent1,"!important}",
      ".progress-bar,.progress-fill{background:linear-gradient(90deg,",secondary,",",accent2,",",accent3,")!important}",
      "input:focus,select:focus,textarea:focus,button:focus-visible{outline-color:",accent1,"!important}",
      "table thead th{border-bottom-color:",accent1,"}",
      "body[data-institution-portal=true],html[data-institution-portal=true]{--primary:",primary,";--secondary:",secondary,";--accent:",accent1,";--accent-2:",accent2,";--accent-3:",accent3,";--accent-4:",accent4,"}",
      "header,.topbar,.top-bar,.top-header,.dashboard-header,.page-header,.main-header,.navbar,.top-nav{border-color:",secondary,"33}",
      ".topbar,.top-bar,.top-header,.main-header{--header-brand-color:",primary,"}",
      ".dashboard-hero,.page-hero,.welcome-banner,.welcome-card,.command-hero,.lecturer-command-hero{background-image:linear-gradient(120deg,",primary," 0%,",secondary," 100%)!important;border-color:",secondary,"!important}",
      ".dashboard-hero h1,.dashboard-hero h2,.page-hero h1,.welcome-banner h1,.welcome-card h1{color:#fff!important}",
      ".stat-card,.metric-card,.dashboard-card,.analytics-card,.summary-card,.kpi-card,.overview-card,.quick-stat,.metric-tile{border-top-color:",accent1,"!important}",
      ".stat-card .icon,.metric-card .icon,.dashboard-card .card-icon,.analytics-card .card-icon,.summary-card .icon,.kpi-card .icon{background-color:",accent2,"22!important;color:",secondary,"!important}",
      ".stat-card:nth-child(6n+2),.metric-card:nth-child(6n+2),.dashboard-metric-grid>div:nth-child(6n+2){--card-accent:",accent2,"}",
      ".stat-card:nth-child(6n+3),.metric-card:nth-child(6n+3),.dashboard-metric-grid>div:nth-child(6n+3){--card-accent:",accent3,"}",
      ".stat-card:nth-child(6n+4),.metric-card:nth-child(6n+4),.dashboard-metric-grid>div:nth-child(6n+4){--card-accent:",accent4,"}",
      ".stat-card,.metric-card,.dashboard-metric-grid>div{border-bottom:2px solid var(--card-accent,",accent1,")}",
      ".sidebar a:hover,.sidebar-menu a:hover,#sidebar .nav a:hover{background-color:",secondary,"33!important}",
      ".sidebar .active,.sidebar-menu .active,#sidebar .nav .active{background-color:",secondary,"44!important}",
      ".tab-button.active,.nav-link.active,.nav-item.active,[aria-current=page]{color:",primary,"!important}",
      ".badge-primary,.status-primary,.chip-primary,.tag-primary{background-color:",primary,"!important;color:#fff!important}",
      ".badge-success,.status-success,.chip-success{background-color:",secondary,"!important;color:#fff!important}",
      ".section-title,.panel-title,.card-title,.dashboard-section-title{border-left-color:",accent1,"}",
      ".form-control:focus,.form-select:focus,.ia-input:focus,.ia-select:focus{border-color:",accent1,"!important;box-shadow:0 0 0 3px ",accent1,"22!important}",
      ".btn-primary:hover,.primary-button:hover,.primary-btn:hover,.ia-primary-btn:hover,.submit:hover{filter:brightness(1.08)}",
      ".sidebar-header .cn-institution-school-code{color:#fff!important}",
      ".brand-logo img,.sidebar-logo img,.institution-logo img,#institutionLogo,.header-logo img{object-fit:contain!important}",
      ".cn-institution-brand-name{font-weight:800;letter-spacing:-.02em}"
    ].join("");

    document.querySelectorAll("h1,h2,h3,[role=heading]").forEach(el => {
      const current = String(el.textContent || "").trim();
      if (/^NCHSM\b.*(portal|dashboard|exam)|^(?:portal|dashboard|exam).*NCHSM\b/i.test(current)) {
        el.textContent = title;
      }
    });
    document.querySelectorAll('input[value="NCHSM Exam Proctoring System"]').forEach(input => {
      input.value = identity + " Examination System";
    });

    document.querySelectorAll(".nchsm-pwa-install,[data-pwa-install],#installBtn,#installButton").forEach(button => {
      if (!/install/i.test(button.textContent || "")) return;
      const icon = button.querySelector("i");
      const label = "Install " + identity + " Portal";
      if (icon) button.replaceChildren(icon, document.createTextNode(" " + label));
      else button.textContent = label;
      button.setAttribute("aria-label", label);
    });

    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink && window.Blob && window.URL && URL.createObjectURL) {
      try {
        if (window.cnTenantManifestUrl) URL.revokeObjectURL(window.cnTenantManifestUrl);
        const manifest = {
          id: location.pathname + "?school_code=" + encodeURIComponent(schoolCode),
          name: title,
          short_name: (schoolCode || name).slice(0, 20),
          description: identity + " secure learning and administration portal",
          start_url: location.pathname + "?school_code=" + encodeURIComponent(schoolCode),
          scope: "/platform/",
          display: "standalone",
          orientation: "portrait",
          theme_color: primary,
          background_color: "#ffffff",
          icons: [{src: logo, sizes: "192x192", purpose: "any maskable"}]
        };
        window.cnTenantManifestUrl = URL.createObjectURL(
          new Blob([JSON.stringify(manifest)], {type: "application/manifest+json"})
        );
        manifestLink.href = window.cnTenantManifestUrl;
      } catch (error) {
        console.warn("[Campus Nexus] Tenant install metadata could not be generated:", error);
      }
    }

    applied = true;
    document.dispatchEvent(new CustomEvent("campusnexus:institution-branding-applied", {
      detail: {institutionId: institution.id, name, schoolCode, logoUrl: institution.logo_url || null}
    }));
    console.info("[Campus Nexus] Institution branding applied:", title);
  }

  async function resolveInstitution(client) {
    const auth = await client.auth.getUser();
    const user = auth.data && auth.data.user;
    if (auth.error || !user) return;

    // Exam Login performs the institution/role verification before routing to
    // the dedicated dashboards. Reuse that verified hand-off if profile lookup
    // is delayed or its RLS policy differs from the normal portal.
    let handoff = null;
    try {
      const raw = sessionStorage.getItem("campusNexusExamLecturerAuth")
        || localStorage.getItem("campusNexusExamLecturerAuth")
        || sessionStorage.getItem("campusNexusExamAdminAuth")
        || localStorage.getItem("campusNexusExamAdminAuth");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && String(parsed.user_id || "") === String(user.id)
          && parsed.institution_id && parsed.institution_name) handoff = parsed;
      }
    } catch (_) {}

    let profile = {};
    const profileResult = await client.from("consolidated_user_profiles_table")
      .select("institution_id,role,status").eq("user_id", user.id).maybeSingle();
    if (!profileResult.error) profile = profileResult.data || {};
    else if (!handoff) throw profileResult.error;

    const role = String(profile.role || handoff?.role || "").toLowerCase();
    if (["superadmin", "super_admin", "platform_super_admin"].includes(role)) return;

    let institutionId = profile.institution_id || handoff?.institution_id || null;
    if (!institutionId) {
      const memberships = await client.from("institution_users")
        .select("institution_id,role,status").eq("user_id", user.id).eq("status", "active");
      if (memberships.error) throw memberships.error;
      const ids = [...new Set((memberships.data || []).map(row => row.institution_id).filter(Boolean))];
      if (ids.length !== 1) return;
      institutionId = ids[0];
    }

    const result = await client.from("institutions")
      .select("id,name,short_code,school_code,logo_url,primary_color,secondary_color,brand_colors,physical_address,postal_address,status")
      .eq("id", institutionId).maybeSingle();
    if (result.error) throw result.error;
    if (!result.data || String(result.data.status || "").toLowerCase() === "suspended") return;
    applyBranding(result.data);
  }

  async function boot() {
    if (applied || attempts++ > 50) return;
    const client = getClient();
    if (!client) {
      window.setTimeout(boot, 400);
      return;
    }
    try {
      await resolveInstitution(client);
    } catch (error) {
      console.warn("[Campus Nexus] Institution branding not applied:", error && error.message || error);
      if (!applied && attempts < 50) window.setTimeout(boot, 900);
    }
  }

  window.addEventListener("appReady", () => { if (!applied) boot(); });
  window.addEventListener("load", () => { if (!applied) boot(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, {once: true});
  else boot();
  window.addEventListener("pageshow", () => { if (!applied) boot(); });
})();