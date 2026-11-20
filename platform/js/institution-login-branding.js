/* Campus Nexus — institution-aware login branding */
(function () {
  "use strict";
  const params = new URLSearchParams(window.location.search);
  const code = (params.get("school_code") || "").trim();
  if (!code) return;

  const SUPABASE_URL = "https://lwhtjozfsmbyihenfunw.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3aHRqb3pmc21ieWloZW5mdW53Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NTgxMjcsImV4cCI6MjA3NTIzNDEyN30.7Z8AYvPQwTAEEEhODlW6Xk-IR1FK3Uj5ivZS7P17Wpk";

  function applyBranding(institution) {
    if (!institution || !institution.institution_id) {
      console.warn("[Campus Nexus] No active institution resolved for school code.");
      return;
    }

    const name = institution.institution_name || "Your Institution";
    const primary = institution.primary_color || institution.brand_colors?.[0] || "#082f49";
    const secondary = institution.secondary_color || institution.brand_colors?.[1] || "#0f766e";
    const gold = institution.brand_colors?.[2] || "#d4a017";

    document.documentElement.style.setProperty("--nchsm-navy", primary);
    document.documentElement.style.setProperty("--nchsm-teal", secondary);
    document.documentElement.style.setProperty("--nchsm-gold", gold);
    document.documentElement.style.setProperty("--institution-primary", primary);
    document.documentElement.style.setProperty("--institution-secondary", secondary);
    document.documentElement.dataset.institutionLogin = "true";
    document.documentElement.dataset.institutionId = institution.institution_id;
    document.documentElement.dataset.schoolCode = institution.school_code || code;

    let theme = document.getElementById("cn-institution-login-theme");
    if (!theme) {
      theme = document.createElement("style");
      theme.id = "cn-institution-login-theme";
      document.head.appendChild(theme);
    }
    theme.textContent = `
      .left-panel{background:linear-gradient(180deg, ${primary}b8 0%, ${primary}d9 48%, ${primary}f2 100%),url("images/campus-header.jpg") center center/cover no-repeat!important}
      .left-panel:before{background:radial-gradient(circle at 80% 15%,${secondary}55,transparent 34%),linear-gradient(135deg,${primary}22,transparent 55%)!important}
      .left-panel:after{background:linear-gradient(180deg,${primary}12,${primary}55)!important}
      .college-name .gold,.gold{color:${gold}!important}
      .welcome-section h2:after{background:${gold}!important}
      .logo-wrapper .logo{border-color:${gold}!important}
      .login-button{background:linear-gradient(135deg,${secondary},${primary})!important;box-shadow:0 11px 25px ${primary}35!important}
      .login-button:hover{box-shadow:0 14px 30px ${primary}55!important}
    `;

    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
    const logoImages = document.querySelectorAll(
      ".logo-wrapper .logo img, .mobile-header .logo img, .welcome-icon.logo-welcome img, .nchsm-loading-logo img"
    );
    logoImages.forEach(function (img) {
      if (institution.logo_url && /^https:\/\/\//i.test(institution.logo_url)) {
        img.src = institution.logo_url;
        img.alt = name + " logo";
        img.hidden = false;
      } else {
        const holder = img.parentElement;
        if (!holder) return;
        const monogram = document.createElement("span");
        monogram.textContent = initials || "IN";
        monogram.setAttribute("aria-label", name + " initials");
        monogram.style.cssText = "display:grid;place-items:center;width:100%;height:100%;border-radius:inherit;background:"+primary+";color:#fff;font-weight:800;font-size:clamp(17px,3vw,25px);letter-spacing:.04em;";
        holder.replaceChildren(monogram);
        holder.style.background = "#fff";
        holder.style.overflow = "hidden";
      }
    });

    document.querySelectorAll(".logo-wrapper .college-name, .mobile-header .college-name").forEach(function (heading) {
      heading.textContent = name;
      heading.style.color = "#fff";
      heading.style.maxWidth = "min(100%, 520px)";
      heading.style.overflowWrap = "anywhere";
    });

    const motto = document.querySelector(".logo-wrapper .motto");
    if (motto) {
      const address = [institution.physical_address, institution.postal_address].filter(Boolean).join(" · ");
      motto.textContent = address || "Institution learning portal";
    }

    const welcome = document.querySelector(".welcome-section h2");
    if (welcome) welcome.textContent = "Welcome to " + name;

    const tagline = document.querySelector(".welcome-section .tagline");
    if (tagline) tagline.textContent = "Your institution's secure learning and administration portal";
    const loginSubtitle = document.querySelector(".welcome-subtitle");
    if (loginSubtitle) loginSubtitle.textContent = "Sign in to access your " + name + " account";
    const loadingText = document.getElementById("nchsmLoadingText");
    if (loadingText) loadingText.textContent = "Securely verifying your " + name + " account. Please wait.";
    const loadingTitle = document.querySelector(".nchsm-loading-title");
    if (loadingTitle) loadingTitle.innerHTML = "Signing you <span>in…</span>";

    const pageTitle = name + " | Secure Sign In";
    document.title = pageTitle;

    const brandLabel = document.querySelector(".login-card h1, .login-card h2, .login-panel h1, .login-panel h2");
    if (brandLabel && /campus nexus/i.test(brandLabel.textContent)) {
      brandLabel.textContent = "Welcome Back";
    }

    console.info("[Campus Nexus] Institution branding applied:", name, "school code:", code);
  }

  async function loadBranding() {
    try {
      const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/resolve_institution_registration_context", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ p_code: code, p_host: null }),
        cache: "no-store"
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error("Institution lookup failed (" + response.status + "): " + detail.slice(0, 240));
      }
      const institution = await response.json();
      if (Array.isArray(institution)) applyBranding(institution[0]);
      else applyBranding(institution);
    } catch (error) {
      console.error("[Campus Nexus] Institution branding could not be loaded:", error);
      document.documentElement.dataset.institutionBrandingError = "true";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadBranding, { once: true });
  } else {
    loadBranding();
  }
})();