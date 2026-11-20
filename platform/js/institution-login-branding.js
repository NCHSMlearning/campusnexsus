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

    const logoImage = document.querySelector(".logo-wrapper .logo img");
    const logoBox = document.querySelector(".logo-wrapper .logo");
    if (logoImage && institution.logo_url && /^https:\/\//i.test(institution.logo_url)) {
      logoImage.src = institution.logo_url;
      logoImage.alt = name + " logo";
      logoImage.hidden = false;
    } else if (logoBox) {
      // No institution logo has been uploaded: show a clean institution monogram,
      // not the generic Campus Nexus mark.
      const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
      logoBox.innerHTML = "";
      const monogram = document.createElement("span");
      monogram.textContent = initials || "IN";
      monogram.setAttribute("aria-label", name + " initials");
      monogram.style.cssText = "display:grid;place-items:center;width:100%;height:100%;border-radius:inherit;background:"+primary+";color:#fff;font-weight:800;font-size:24px;letter-spacing:.04em;";
      logoBox.appendChild(monogram);
      logoBox.style.background = "#fff";
    }

    const heading = document.querySelector(".logo-wrapper .college-name");
    if (heading) {
      heading.textContent = name;
      heading.style.color = "#fff";
      heading.style.maxWidth = "min(100%, 520px)";
      heading.style.overflowWrap = "anywhere";
    }

    const motto = document.querySelector(".logo-wrapper .motto");
    if (motto) {
      const address = [institution.physical_address, institution.postal_address].filter(Boolean).join(" · ");
      motto.textContent = address || "Institution learning portal";
    }

    const welcome = document.querySelector(".welcome-section h2");
    if (welcome) welcome.textContent = "Welcome to " + name;

    const tagline = document.querySelector(".welcome-section .tagline");
    if (tagline) tagline.textContent = "Your institution's secure learning and administration portal";

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