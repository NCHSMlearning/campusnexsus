(function () {
  'use strict';
  function navigate(tabId) {
    if (!tabId) return false;
    var target = document.getElementById(tabId);
    if (!target || !target.classList.contains('tab-content')) return false;
    document.querySelectorAll('.tab-content').forEach(function (tab) {
      var selected = tab === target;
      tab.classList.toggle('active', selected);
      tab.style.setProperty('display', selected ? 'block' : 'none', 'important');
      if (selected) {
        tab.removeAttribute('hidden');
        tab.setAttribute('aria-hidden', 'false');
      } else {
        tab.setAttribute('hidden', '');
        tab.setAttribute('aria-hidden', 'true');
      }
    });
    document.querySelectorAll('.sidebar-nav-premium a[data-tab], .dropdown-submenu a[data-tab]').forEach(function (item) {
      item.classList.toggle('active', item.getAttribute('data-tab') === tabId);
    });
    try {
      localStorage.setItem('nchsm_current_tab', tabId);
      var hash = '#' + encodeURIComponent(tabId);
      if (location.hash !== hash) history.replaceState(null, '', hash);
    } catch (_) {}
    if (window.matchMedia && window.matchMedia('(max-width: 1023px)').matches) {
      var sidebar = document.getElementById('sidebar');
      var overlay = document.getElementById('overlay');
      if (sidebar) sidebar.classList.remove('active', 'open');
      if (overlay) overlay.classList.remove('active');
      document.body.classList.remove('nchsm-nav-open');
      document.body.style.overflow = '';
    }
    window.setTimeout(function () {
      target.removeAttribute('hidden');
      target.setAttribute('aria-hidden', 'false');
      target.style.setProperty('display', 'block', 'important');
      target.classList.add('active');
    }, 0);
    return true;
  }
  window.nchsmNavigateToTab = navigate;
  document.addEventListener('click', function (event) {
    var link = event.target && event.target.closest
      ? event.target.closest('.sidebar-nav-premium a[data-tab], .dropdown-submenu a[data-tab]')
      : null;
    if (!link || !navigate(link.getAttribute('data-tab'))) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }, true);
  window.addEventListener('hashchange', function () {
    var tabId = '';
    try { tabId = decodeURIComponent((location.hash || '').replace(/^#/, '')); } catch (_) {}
    if (tabId) navigate(tabId);
  });
  function activateInitialHash() {
    var tabId = '';
    try { tabId = decodeURIComponent((location.hash || '').replace(/^#/, '')); } catch (_) {}
    if (tabId) navigate(tabId);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', activateInitialHash, { once: true });
  } else {
    activateInitialHash();
  }
})();
