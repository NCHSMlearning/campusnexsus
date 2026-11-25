'use strict';
/*
 * Secure Exam Browser workspace navigation.
 * This file extends the existing Admin Exams UI; it does not replace the
 * examination engine or claim live device telemetry before its backend exists.
 */
(function () {
  const titles = {
    cnsebOverview: ['Secure Browser Overview', 'Examination security and device monitoring'],
    cnsebDevices: ['Devices & Installations', 'Registered computers, app versions and enrollment'],
    cnsebSessions: ['Live Exam Sessions', 'Active secure examination sessions'],
    cnsebAlerts: ['Security Events', 'Secure Browser and device security incidents'],
    cnsebAudit: ['Device Audit Trail', 'Enrollment, update, revocation and administrator history']
  };

  function setWorkspaceTitle(tab) {
    const item = titles[tab];
    if (!item) return false;
    const title = document.getElementById('pageTitle');
    const subtitle = document.getElementById('pageSubtitle');
    if (title) title.innerHTML = '<i class="fas fa-shield-alt"></i> ' + item[0];
    if (subtitle) subtitle.textContent = item[1];
    return true;
  }

  function installNavigation() {
    if (typeof window.switchTab !== 'function' || window.switchTab.__cnsebWrapped) return false;
    const original = window.switchTab;
    const wrapped = function (tab) {
      original.call(this, tab);
      setWorkspaceTitle(tab);
    };
    wrapped.__cnsebWrapped = true;
    window.switchTab = wrapped;
    return true;
  }

  if (!installNavigation()) {
    let attempts = 0;
    const retry = window.setInterval(function () {
      attempts += 1;
      if (installNavigation() || attempts >= 30) window.clearInterval(retry);
    }, 100);
  }

  // Allow direct links to a Secure Browser tab without changing the legacy
  // dashboard's default landing tab.
  document.addEventListener('DOMContentLoaded', function () {
    const requested = new URLSearchParams(window.location.search).get('cnseb_tab');
    if (requested && titles[requested]) {
      window.setTimeout(function () {
        if (typeof window.switchTab === 'function') window.switchTab(requested);
      }, 250);
    }
  });

  window.CampusNexusSecureBrowserWorkspace = Object.freeze({
    tabs: Object.keys(titles),
    open: function (tab) {
      if (!titles[tab] || typeof window.switchTab !== 'function') return false;
      window.switchTab(tab);
      return true;
    }
  });
})();
