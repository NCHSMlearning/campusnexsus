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
    return typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
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
    if (/\/admin(?:\.html)?$|\/source\/admin(?:exams)?\.html$/.test(path)) return "Administrator";
    if (/exam|examination/.test(path)) return "Examinations";
    if (/student/.test(path)) return "Student";
    return "Institution";
  }
  function setText(selector, value) {
    document.querySelectorAll(selector).forEach(el => { el.textContent = value; });
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
    const primary = safeColor(institution.primary_color, "#082f49");
    const secondary = safeColor(institution.secondary_color, "#0f766e");
    const colors = Array.isArray(institution.brand_colors) ? institution.brand_colors : [];
    const gold = safeColor(colors[2], "#d4a017");
    const logo = institution.logo_url && /^https:\/\//i.test(institution.logo_url)
      ? institution.logo_url : fallbackLogo(name, primary, secondary);

    const root = document.documentElement;
    root.dataset.institutionPortal = "true";
    root.dataset.institutionId = String(institution.id);
    root.dataset.institutionName = name;
    root.dataset.institutionCode = schoolCode;
    root.dataset.schoolCode = schoolCode;
    root.style.setProperty("--cn-institution-primary", primary);
    root.style.setProperty("--cn-institution-secondary", secondary);
    root.style.setProperty("--cn-institution-gold", gold);

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
      document.head.appendChild(theme);
    }
    theme.textContent = [
      ":root{--cn-institution-primary:", primary, ";--cn-institution-secondary:", secondary, ";--cn-institution-gold:", gold, "}",
      "#sidebar,.sidebar{background-color:", primary, "!important;background-image:linear-gradient(180deg,", primary, ",", primary, " 68%,", secondary, ")!important}",
      ".sidebar-header,.sidebar-brand,.nchsm-header-brand{border-color:", secondary, "55!important}",
      ".sidebar-header img,.brand-crest img,.nchsm-header-logo,.mobile-header .logo img,.header-content .logo img,.nchsm-loading-logo img{object-fit:contain!important}",
      ".sidebar a.active,.sidebar-menu a.active,#sidebar .nav a.active{border-left-color:", gold, "!important}",
      ".nchsm-header-title,.brand-text .cn-institution-brand-name{color:", primary, "!important}",
      ".nchsm-header-subtitle{color:", secondary, "!important}",
      ".cn-institution-school-code{display:block;font-size:11px;font-weight:600;opacity:.85}",
      ".cn-institution-portal-role{display:block;font-size:12px;font-weight:500}",
      ".admin-badge{border-color:", gold, "66!important}"
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

    const profileResult = await client.from("consolidated_user_profiles_table")
      .select("institution_id,role,status").eq("user_id", user.id).maybeSingle();
    if (profileResult.error) throw profileResult.error;
    const profile = profileResult.data || {};
    const role = String(profile.role || "").toLowerCase();
    if (["superadmin", "super_admin", "platform_super_admin"].includes(role)) return;

    let institutionId = profile.institution_id || null;
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