/* Campus Nexus Admin Exams — casual source-inspection deterrent.
 * Set window.DEBUG = true below when development tools/context menu are needed.
 * This is a browser-side deterrent, not a security boundary.
 */
(function () {
  "use strict";

  // Change this to true during development to restore right-click and shortcuts.
  window.DEBUG = false;

  function debugEnabled() {
    return window.DEBUG === true;
  }

  function blockEvent(event) {
    if (debugEnabled()) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === "function") {
      event.stopImmediatePropagation();
    }
    return false;
  }

  document.addEventListener("contextmenu", function (event) {
    if (debugEnabled()) return;
    // Keep native context menus available inside editable controls.
    if (event.target && event.target.closest &&
        event.target.closest("input, textarea, select, [contenteditable='true']")) return;
    blockEvent(event);
  }, true);

  document.addEventListener("keydown", function (event) {
    if (debugEnabled()) return;
    const key = String(event.key || "").toLowerCase();
    const ctrlOrMeta = event.ctrlKey || event.metaKey;
    const blocked =
      key === "f12" ||
      (ctrlOrMeta && event.shiftKey && ["i", "j", "c"].includes(key)) ||
      (ctrlOrMeta && ["u", "s"].includes(key));

    if (blocked) blockEvent(event);
  }, true);

  document.addEventListener("dragstart", function (event) {
    if (debugEnabled()) return;
    if (event.target && event.target.closest &&
        event.target.closest("input, textarea, [contenteditable='true'], img")) return;
    blockEvent(event);
  }, true);

  console.info("[Campus Nexus] Admin Exams browser guard active. Set window.DEBUG = true to disable it.");
})();
