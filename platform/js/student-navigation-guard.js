(function () {
  'use strict';
  // One navigation owner: student-navigation.js. This file only bridges
  // delegated sidebar clicks to that controller and blocks duplicate handlers.
  function navigate(tabId) {
    if (!tabId || typeof window.showTab !== 'function') return false;
    window.showTab(tabId);
    return true;
  }
  window.nchsmNavigateToTab = navigate;
  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest
      ? event.target.closest('.sidebar-nav-premium a[data-tab], .dropdown-submenu a[data-tab]')
      : null;
    if (!link) return;
    var destination = link.getAttribute('data-tab');
    if (!destination || !document.getElementById(destination)) return;
    var anchor = (link.getAttribute('href') || '').replace(/^#/, '');
    var scrollTarget = anchor && anchor !== destination ? document.getElementById(anchor) : null;
    // If the primary controller is unavailable, leave the native link alone.
    if (typeof window.showTab !== 'function') return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    navigate(destination);
    if (scrollTarget) window.setTimeout(function () {
      scrollTarget.scrollIntoView({ behavior: 'auto', block: 'start' });
    }, 120);
  }, true);
})();
