/* Campus Nexus — institution-aware login branding */
(function () {
  "use strict";
  const params = new URLSearchParams(window.location.search);
  const code = (params.get("school_code") || "").trim();
  if (!code) return;

  const SUPABASE_URL = "https://irahplkvocaakjxuisto.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_5Cg5FFudf03UnmOXGNGMHQ_uK9S-uQX";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlyYWhwbGt2b2NhYWtqeHVpc3RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4ODY5ODQsImV4cCI6MjEwMzQ2Mjk4NH0.BFOwdRVDz4r1oYgUjm8zQbthqblGRq4c3WQWQaOhu7g";

  function applyBranding(institution) {
    if (!institution || !institution.institution_id) {
      console.warn("[Campus Nexus] No active institution resolved for school code.");
      return;
    }

    const name = institution.institution_name || "Your Institution";
    const schoolCode = String(institution.school_code || code).trim();
    const identity = schoolCode ? name + " (" + schoolCode + ")" : name;
    const source=institution.brand_colors&&typeof institution.brand_colors==="object"?institution.brand_colors:[];
    const named=!Array.isArray(source)?source:{};
    const values=Array.isArray(source)?source:[named.primary,named.secondary,named.accent1||named.accent||named.gold||named.tertiary,named.accent2,named.accent3,named.accent4];
    const normalizeColor=(value,fallback)=>{if(typeof value!=="string")return fallback;if(/^#[0-9a-f]{3}$/i.test(value))return "#"+value.slice(1).split("").map(ch=>ch+ch).join("");return /^#[0-9a-f]{6}$/i.test(value)?value:fallback;};
    const defaults=["#082f49","#0f766e","#d4a017","#2563eb","#7c3aed","#db2777"];
    const colors=defaults.map((fallback,index)=>normalizeColor(index===0?(institution.primary_color||values[index]):index===1?(institution.secondary_color||values[index]):values[index],fallback));
    const [primary,secondary,gold,accent2,accent3,accent4]=colors;

    colors.forEach((color,index)=>document.documentElement.style.setProperty("--cn-institution-color-"+(index+1),color));
    document.documentElement.style.setProperty("--nchsm-navy",primary);document.documentElement.style.setProperty("--nchsm-teal",secondary);document.documentElement.style.setProperty("--nchsm-gold",gold);
    document.documentElement.style.setProperty("--institution-primary",primary);document.documentElement.style.setProperty("--institution-secondary",secondary);document.documentElement.style.setProperty("--institution-gold",gold);
    document.documentElement.style.setProperty("--cn-brand-primary",primary);document.documentElement.style.setProperty("--cn-brand-secondary",secondary);document.documentElement.style.setProperty("--cn-brand-accent",gold);
    document.documentElement.style.setProperty("--cn-brand-accent-2",accent2);document.documentElement.style.setProperty("--cn-brand-accent-3",accent3);document.documentElement.style.setProperty("--cn-brand-accent-4",accent4);
    document.documentElement.dataset.institutionLogin = "true";
    document.documentElement.dataset.institutionName = name;
    document.documentElement.dataset.institutionId = institution.institution_id;
    document.documentElement.dataset.schoolCode = institution.school_code || code;

    let theme = document.getElementById("cn-institution-login-theme");
    if (!theme) {
      theme = document.createElement("style");
      theme.id = "cn-institution-login-theme";
      document.head.appendChild(theme);
    }
    theme.textContent = `
      :root{--cn-institution-primary:${primary};--cn-institution-secondary:${secondary};--cn-institution-gold:${gold};--cn-institution-color-1:${primary};--cn-institution-color-2:${secondary};--cn-institution-color-3:${gold};--cn-institution-color-4:${accent2};--cn-institution-color-5:${accent3};--cn-institution-color-6:${accent4};--cn-brand-primary:${primary};--cn-brand-secondary:${secondary};--cn-brand-accent:${gold};--cn-brand-accent-2:${accent2};--cn-brand-accent-3:${accent3};--cn-brand-accent-4:${accent4}}
      .left-panel{background:linear-gradient(180deg, ${primary}b8 0%, ${primary}d9 48%, ${primary}f2 100%)!important}
      .left-panel:before{background:radial-gradient(circle at 80% 15%,${secondary}55,transparent 34%),linear-gradient(135deg,${primary}22,transparent 55%)!important}
      .left-panel:after{background:linear-gradient(180deg,${primary}12,${primary}55)!important}
      .college-name .gold,.gold{color:${gold}!important}
      .welcome-section h2:after{background:${gold}!important}
      .logo-wrapper .logo{border-color:${gold}!important}
      .login-button{background:linear-gradient(135deg,${secondary},${primary})!important;box-shadow:0 11px 25px ${primary}35!important}
      .login-button:hover{box-shadow:0 14px 30px ${primary}55!important}
      input:focus,select:focus,textarea:focus{border-color:${gold}!important;box-shadow:0 0 0 3px ${gold}22!important}
      .login-button,.submit{background:linear-gradient(135deg,${secondary},${primary})!important}
      a{color:${accent2}}
    `;

    const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase();
    const logoImages = document.querySelectorAll(
      ".logo-wrapper .logo img, .mobile-header .logo img, .welcome-icon.logo-welcome img, .nchsm-loading-logo img"
    );
    logoImages.forEach(function (img) {
      if (institution.logo_url && /^https:\/\//i.test(institution.logo_url)) {
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
      let codeLabel = heading.parentElement && heading.parentElement.querySelector(".cn-login-school-code");
      if (!codeLabel) {
        codeLabel = document.createElement("small");
        codeLabel.className = "cn-login-school-code";
        heading.insertAdjacentElement("afterend", codeLabel);
      }
      codeLabel.textContent = schoolCode ? "School Code: " + schoolCode : "";
      codeLabel.style.cssText = "display:block;margin-top:5px;color:#fff;font-size:11px;font-weight:700;letter-spacing:.08em;opacity:.9";
    });
    document.querySelectorAll(".mobile-header .college-tagline").forEach(function (tagline) {
      tagline.textContent = "Powered by Campus Nexus";
    });

    const motto = document.querySelector(".logo-wrapper .motto");
    if (motto) {
      const address = [institution.physical_address, institution.postal_address].filter(Boolean).join(" · ");
      motto.textContent = address || "Institution learning portal";
      let powered = document.querySelector(".logo-wrapper .cn-powered-by");
      if (!powered) {
        powered = document.createElement("small");
        powered.className = "cn-powered-by";
        motto.insertAdjacentElement("afterend", powered);
      }
      powered.textContent = "Powered by Campus Nexus";
      powered.style.cssText = "display:block;margin-top:7px;font-size:10px;font-weight:600;letter-spacing:.08em;color:rgba(255,255,255,.82)";
    }

    const welcome = document.querySelector(".welcome-section h2");
    if (welcome) welcome.textContent = "Welcome to " + name;

    const tagline = document.querySelector(".welcome-section .tagline");
    if (tagline) tagline.textContent = "Your institution's secure learning and administration portal";
    const loginSubtitle = document.querySelector(".welcome-subtitle");
    if (loginSubtitle) loginSubtitle.textContent = "Sign in to access " + identity;
    const loadingText = document.getElementById("nchsmLoadingText");
    if (loadingText) loadingText.textContent = "Securely verifying your " + identity + " account. Please wait.";
    const loadingTitle = document.querySelector(".nchsm-loading-title");
    if (loadingTitle) loadingTitle.innerHTML = "Signing you <span>in…</span>";

    const pageTitle = identity + " | Secure Sign In";
    document.title = pageTitle;

    const brandLabel = document.querySelector(".login-card h1, .login-card h2, .login-panel h1, .login-panel h2");
    if (brandLabel && /campus nexus/i.test(brandLabel.textContent)) {
      brandLabel.textContent = "Welcome Back";
    }

    console.info("[Campus Nexus] Institution branding applied:", identity);
  }

  async function loadBranding() {
    try {
      const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/resolve_institution_registration_context", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_PUBLISHABLE_KEY,
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