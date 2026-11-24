/* Campus Nexus global dashboard interaction guard.
 * Convenience deterrent only; never rely on client-side code to protect secrets.
 * Append ?debug=true to enable normal browser debugging for this page.
 */
(function () {
  'use strict';
  const params = new URLSearchParams(window.location.search);
  const debugEnabled = params.get('debug') === 'true';
  if (debugEnabled) {
    document.documentElement.dataset.cnDebug = 'true';
    console.info('[Campus Nexus] Debug mode enabled. Dashboard protections are bypassed.');
    return;
  }
  document.documentElement.dataset.cnGuard = 'active';
  const editable = el => !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
  document.addEventListener('contextmenu', event => {
    if (!editable(event.target)) event.preventDefault();
  }, true);
  document.addEventListener('dragstart', event => {
    if (!editable(event.target)) event.preventDefault();
  }, true);
  document.addEventListener('selectstart', event => {
    if (!editable(event.target) && !event.target.closest('[data-allow-select],.allow-text-selection')) event.preventDefault();
  }, true);
  document.addEventListener('keydown', event => {
    if (editable(event.target)) return;
    const key = String(event.key || '').toLowerCase();
    const ctrl = event.ctrlKey || event.metaKey;
    const devtools = key === 'f12' || (ctrl && event.shiftKey && ['i','j','c'].includes(key));
    const sourceOrSave = ctrl && ['u','s'].includes(key);
    if (devtools || sourceOrSave) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);
  // Do not intercept clicks: help (?) controls, menus, forms and accessibility
  // interactions must continue to work normally.
})();