/* Campus Nexus global brand identity.
 * Uses the official supplied Campus Nexus logo while preserving institution
 * logos that are loaded from external/custom institution branding settings.
 */
(function () {
  "use strict";
  var BRAND = "/images/campus-nexus-original-logo.webp?v=1";
  var BRAND_ALT = "Campus Nexus — Smart Campus. Connected Future.";
  var LOCAL_BRAND_PATTERN = /(logo|brand)/i;

  function applyBranding() {
    var images = document.querySelectorAll(
      'img[src], img[alt], .brand-image img, .footer-brand-image img, ' +
      '.logo-wrapper .logo img, .logo-welcome img, .nchsm-loading-logo img, ' +
      '.navbar-brand img, .site-logo img, .header-logo img'
    );
    images.forEach(function (img) {
      if (img.dataset.campusNexusBrandApplied === "true") return;
      if (img.hasAttribute("data-institution-logo") || img.closest("[data-institution-logo]")) return;
      var src = img.getAttribute("src") || "";
      var alt = img.getAttribute("alt") || "";
      // Never replace externally hosted institution-specific logos.
      if (src.toLowerCase().startsWith("http") && !src.toLowerCase().startsWith(window.location.origin.toLowerCase())) return;
      var knownBrandContainer = img.closest(".brand-image, .footer-brand-image, .logo-wrapper .logo, .logo-welcome, .nchsm-loading-logo, .navbar-brand, .site-logo, .header-logo");
      if (!LOCAL_BRAND_PATTERN.test(src + " " + alt) && !knownBrandContainer) return;
      img.src = BRAND;
      img.alt = BRAND_ALT;
      img.decoding = "async";
      img.loading = "eager";
      img.style.objectFit = "contain";
      img.dataset.campusNexusBrandApplied = "true";
    });

    document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(function (icon) {
      icon.href = BRAND;
      icon.type = "image/webp";
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyBranding, { once: true });
  } else {
    applyBranding();
  }
  if (window.MutationObserver && document.documentElement) {
    var observer = new MutationObserver(function (records) {
      if (records.some(function (record) {
        return Array.prototype.some.call(record.addedNodes || [], function (node) {
          return node.nodeType === 1 && (node.matches?.("img") || node.querySelector?.("img"));
        });
      })) applyBranding();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
