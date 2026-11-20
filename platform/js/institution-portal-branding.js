/* Campus Nexus — authenticated institution branding for tenant portals.
 * Resolves the signed-in user's institution from their own profile/membership.
 * Platform super-admin sessions are intentionally left globally branded.
 */
(function () {
  "use strict";
  const SUPABASE_URL = "https://lwhtjozfsmbyihenfunw.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3aHRqb3pmc21ieWloZW5mdW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NTgxMjcsImV4cCI6MjA3NTIzNDEyN30.7Z8AYvPQwTAEEEhODlW6Xk-IR1FK3Uj5ivZS7P17Wpk";
  let applied = false;
  let attempts = 0;

  function getClient() {
    const candidates = [
      window.sb,
      window.supabaseClient,
      window.db && window.db.supabase,
      window.NCHSMLogin && window.NCHSMLogin.supabase
    ];
    const existing = candidates.find(client =>
      client && typeof client.from === "function" &&
      client.auth && typeof client.auth.getUser === "function"
    );
    if (existing) return existing;

    // Some legacy administrator pages load the Supabase SDK but do not expose
    // their client globally. Create a branding-only client using the same
    // project and default persisted auth storage; do not replace app globals.
    if (window.supabase && typeof window.supabase.createClient === "function") {
      try {
        window.cnInstitutionBrandingClient = window.cnInstitutionBrandingClient ||
          window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return window.cnInstitutionBrandingClient;
      } catch (error) {
        console.warn("[Campus Nexus] Could not initialize branding client:", error);
      }
    }
    return null;
  }

  function safeColor(value, fallback) {
    return typeof value === "string" && /^#[0-9a-f]{3,8}$/i.test(value) ? value : fallback;
  }

  function initials(name) {
    return String(name || "Institution").trim().split(/\s+/).filter(Boolean)
      .slice(0, 2).map(part => part.charAt(0)).join("").toUpperCase() || "IN";
  }

  function fallbackLogo(name, primary, secondary) {
    const label = initials(name);
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">' +
      '<rect width="128" height="128" rx="24" fill="' + primary + '"/>' +
      '<circle cx="64" cy="64" r="53" fill="none" stroke="' + secondary + '" stroke-width="5"/>' +
      '<text x="64" y="76" text-anchor="middle" font-family="Arial,sans-serif" font-size="43" font-weight="700" fill="#ffffff">' + label + '</text></svg>';
    return "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg);
  }

  function applyBranding(institution) {
    if (applied || !institution || !institution.id) return;
    applied = true;
    const name = institution.name || "Your Institution";
    const primary = safeColor(institution.primary_color, "#082f49");
    const secondary = safeColor(institution.secondary_color, "#0f766e");
    const colors = Array.isArray(institution.brand_colors) ? institution.brand_colors : [];
    const gold = safeColor(colors[2], "#d4a017");
    const logo = institution.logo_url && /^https:\/\//i.test(institution.logo_url)
      ? institution.logo_url : fallbackLogo(name, primary, secondary);

    const root = document.documentElement;
    root.dataset.institutionPortal = "true";
    root.dataset.institutionId = institution.id;
    root.dataset.institutionName = name;
    root.dataset.institutionCode = institution.short_code || institution.school_code || "";
    root.dataset.schoolCode = institution.school_code || institution.short_code || "";

    // Keep the application shell, splash screen and PWA install labels aligned
    // with the authenticated institution instead of legacy hardcoded branding.
    const splashTitle = document.querySelector("#loading-screen .welcome-text h1");
    if (splashTitle) splashTitle.textContent = name + (window.location.pathname.toLowerCase().includes("student") ? " Student Portal" : " Portal");
    const splashSubtitle = document.querySelector("#loading-screen .subtitle");
    if (splashSubtitle) splashSubtitle.textContent = "Your Academic Hub";
    document.querySelectorAll('meta[name="application-name"],meta[name="apple-mobile-web-app-title"]').forEach(meta => { meta.content = name + " Portal"; });
    document.querySelectorAll("[data-institution-name]").forEach(el => { el.textContent = name; });
    document.querySelectorAll("[data-institution-code]").forEach(el => { el.textContent = institution.short_code || institution.school_code || ""; });
    document.querySelectorAll(".nchsm-pwa-install,[data-pwa-install],#installBtn,#installButton").forEach(button => {
      const label = button.querySelector("span") || button;
      if (/install\s+nchsm/i.test(label.textContent || "")) label.textContent = "Install " + (institution.short_code || name) + " Portal";
    });
    root.style.setProperty("--cn-institution-primary", primary);
    root.style.setProperty("--cn-institution-secondary", secondary);
    root.style.setProperty("--cn-institution-gold", gold);

    let theme = document.getElementById("cn-authenticated-institution-theme");
    if (!theme) {
      theme = document.createElement("style");
      theme.id = "cn-authenticated-institution-theme";
      document.head.appendChild(theme);
    }
    theme.textContent = `
      :root{--cn-institution-primary:${primary};--cn-institution-secondary:${secondary};--cn-institution-gold:${gold}}
      #sidebar,.sidebar{background-color:${primary}!important;background-image:linear-gradient(180deg,${primary},${primary} 68%,${secondary})!important}
      .sidebar-header,.sidebar-brand,.nchsm-header-brand{border-color:${secondary}55!important}
      .sidebar-header img,.brand-crest img,.nchsm-header-logo,.mobile-header .logo img,.header-content .logo img,.nchsm-loading-logo img{object-fit:contain!important}
      .sidebar-header [data-cn-institution-label],.brand-text [data-cn-institution-label]{color:#fff!important}
      .sidebar a.active,.sidebar-menu a.active,#sidebar .nav a.active{border-left-color:${gold}!important}
      .nchsm-header-title,.brand-text .cn-institution-brand-name{color:${primary}!important}
      .nchsm-header-subtitle{color:${secondary}!important}
      .admin-badge{border-color:${gold}66!important}
    `;

    const logoSelectors = [
      ".sidebar-header img", ".brand-crest img", ".nchsm-header-logo",
      ".mobile-header .logo img", ".header-content .logo img",
      ".nchsm-loading-logo img", ".logo-animation img"
    ];
    document.querySelectorAll(logoSelectors.join(",")).forEach(img => {
      img.src = logo;
      img.alt = name + " logo";
      img.removeAttribute("srcset");
      img.style.objectFit = "contain";
    });

    document.querySelectorAll(".lecturer-command-brand h1").forEach(el => {
      el.textContent = name + " Lecturer Portal";
    });
    document.querySelectorAll(".lecturer-command-brand h1,.lecturer-command-cap").forEach(el => { el.setAttribute("aria-label", name + " Lecturer Portal"); });
    document.querySelectorAll(".lecturer-command-brand h1").forEach(el => { el.title = name + " Lecturer Portal"; });

    const roleHeading = pageRole === "Student" ? "Student Portal"
      : pageRole === "Lecturer" ? "Lecturer Portal"
      : pageRole === "Administrator" ? "Administrator Portal"
      : pageRole === "Student Examination" ? "Student Examination Portal"
      : pageRole === "Examinations" ? "Examination Portal" : "Institution Portal";

    document.querySelectorAll(".brand-text h2").forEach(el => {
      const strong = document.createElement("strong");
      strong.textContent = name;
      const portal = document.createElement("span");
      portal.textContent = roleHeading;
      el.replaceChildren(strong, " ", portal);
    });
    if (pageRole === "Lecturer") {
      document.querySelectorAll(".nrd-kicker").forEach(el => {
        el.textContent = (name + " LECTURER PORTAL").toUpperCase();
      });
    }
    document.querySelectorAll('input[value="NCHSM Exam Proctoring System"]').forEach(input => {
      input.value = name + " Examination System";
    });
    document.querySelectorAll("h1,h2,h3,[role=heading]").forEach(el => {
      const label = String(el.textContent || "").trim();
      if (/NCHSM.*(portal|dashboard|exam)|(?:portal|dashboard|exam).*NCHSM/i.test(label)) {
        el.textContent = name + " " + roleHeading;
      }
    });
    const finalSplashHeading = document.querySelector("#loading-screen .welcome-text h1");
    if (finalSplashHeading) finalSplashHeading.textContent = "Welcome to " + name + " " + roleHeading;

    document.querySelectorAll(".nchsm-pwa-install,[data-pwa-install],#installBtn,#installButton").forEach(button => {
      if (!/install/i.test(button.textContent || "")) return;
      const icon = button.querySelector("i");
      const label = " Install " + (institution.short_code || name) + " Portal";
      if (icon) button.replaceChildren(icon, document.createTextNode(label));
      else button.textContent = label.trim();
    });
    document.querySelectorAll(".lecturer-command-brand p").forEach(el => {
      el.textContent = "Lecturer workspace · teaching, examinations, results and student monitoring";
    });
    document.querySelectorAll(".nchsm-header-title").forEach(el => { el.textContent = name; });
    document.querySelectorAll(".logo-circle").forEach(el => {
      const img = document.createElement("img");
      img.src = logo;
      img.alt = name + " logo";
      img.style.cssText = "width:100%;height:100%;object-fit:contain;border-radius:inherit";
      el.replaceChildren(img);
    });
    document.querySelectorAll(".nchsm-header-subtitle").forEach(el => {
      if (/student portal|digital student portal/i.test(el.textContent)) el.textContent = "Student Portal";
    });

    document.querySelectorAll(".brand-text h2").forEach(el => {
      el.textContent = "";
      const title = document.createElement("strong");
      title.className = "cn-institution-brand-name";
      title.textContent = name;
      const portal = document.createElement("span");
      portal.textContent = "Institution Portal";
      el.append(title, " ", portal);
    });

    document.querySelectorAll(".sidebar-header h2").forEach(el => {
      if (!/nchsm|campus nexus/i.test(el.textContent)) return;
      el.textContent = name;
    });

    const sidebarHeaders = document.querySelectorAll(".sidebar-header");
    sidebarHeaders.forEach(header => {
      let label = header.querySelector("[data-cn-institution-label]");
      if (!label) {
        label = document.createElement("small");
        label.dataset.cnInstitutionLabel = "true";
        label.style.cssText = "display:block;margin-top:5px;font-size:11px;line-height:1.35;opacity:.9;text-align:center";
        header.appendChild(label);
      }
      label.textContent = institution.physical_address || institution.short_code || "Institution portal";
    });

    const loadingHeading = document.querySelector("#loading-screen .welcome-text h1");
    if (loadingHeading) loadingHeading.textContent = name + " Portal";
    const loadingSubtitle = document.querySelector("#loading-screen .subtitle");
    if (loadingSubtitle) loadingSubtitle.textContent = "Your Academic Hub";

    document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"]').forEach(link => {
      link.href = logo;
    });
    const path = String(window.location.pathname || "").toLowerCase();
    const pageRole = /lecturerexams|\/lecturer(?:\.html)?$/.test(path) ? "Lecturer"
      : /\/admin(?:\.html)?$|\/source\/admin(?:exams)?\.html$/.test(path) ? "Administrator"
      : /exam_dashboard/.test(path) ? "Student Examination"
      : /exam|examination/.test(path) ? "Examinations"
      : /student/.test(path) ? "Student" : "Institution";
    const portalTitle = pageRole === "Institution" ? name + " Portal" : name + " " + pageRole + " Portal";
    document.title = portalTitle;

    // Tenant-aware PWA metadata: the platform's public manifest remains
    // Campus Nexus, while an authenticated institution portal advertises
    // its own install name and current school-code entry URL.
    document.querySelectorAll('meta[name="application-name"],meta[name="apple-mobile-web-app-title"]').forEach(meta => {
      meta.content = portalTitle;
    });
    const manifestLink = document.querySelector('link[rel="manifest"]');
    if (manifestLink && window.Blob && window.URL && URL.createObjectURL) {
      try {
        if (window.cnTenantManifestUrl) URL.revokeObjectURL(window.cnTenantManifestUrl);
        const manifest = {
          id: window.location.pathname + window.location.search,
          name: portalTitle,
          short_name: (institution.short_code || name).slice(0, 20),
          description: name + " secure learning and administration portal",
          start_url: window.location.pathname + window.location.search,
          scope: "/platform/",
          display: "standalone",
          orientation: "portrait",
          theme_color: primary,
          background_color: "#ffffff",
          icons: [{src: institution.logo_url && /^https:\/\//i.test(institution.logo_url) ? institution.logo_url : "/images/Logo_NCHSM.png", sizes: "192x192", purpose: "any maskable"}]
        };
        window.cnTenantManifestUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], {type:"application/manifest+json"}));
        manifestLink.href = window.cnTenantManifestUrl;
      } catch (manifestError) {
        console.warn("[Campus Nexus] Tenant install manifest could not be generated:", manifestError);
      }
    }

    document.dispatchEvent(new CustomEvent("campusnexus:institution-branding-applied", {
      detail: { institutionId: institution.id, name, logoUrl: institution.logo_url || null }
    }));
    console.info("[Campus Nexus] Applied authenticated institution branding:", name);
  }

  async function resolveInstitution(client) {
    const auth = await client.auth.getUser();
    const user = auth.data && auth.data.user;
    if (auth.error || !user) return;

    const profileResult = await client.from("consolidated_user_profiles_table")
      .select("institution_id,role,status").eq("user_id", user.id).maybeSingle();
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
      console.warn("[Campus Nexus] Institution portal branding not applied:", error && error.message || error);
      if (!applied && attempts < 50) window.setTimeout(boot, 900);
    }
  }

  window.addEventListener("appReady", () => { if (!applied) boot(); });
  window.addEventListener("load", () => { if (!applied) boot(); });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
  window.addEventListener("pageshow", () => { if (!applied) boot(); });
})();