(function () {
  'use strict';

  const APP_PAGE = '/app-download.html';
  const isAndroid = /Android/i.test(navigator.userAgent || '');
  const isNativeApp = !!(window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform());
  if (!isAndroid || isNativeApp) return;

  function addInstallPrompt() {
    if (document.getElementById('cn-app-install-prompt')) return;
    const client = window.sb || window.supabaseClient;
    if (!client || !client.auth || typeof client.auth.getSession !== 'function') return;

    client.auth.getSession().then(({ data, error }) => {
      if (error || !data || !data.session || document.getElementById('cn-app-install-prompt')) return;
      const bar = document.createElement('aside');
      bar.id = 'cn-app-install-prompt';
      bar.setAttribute('role', 'region');
      bar.setAttribute('aria-label', 'Campus Nexus Android app');
      bar.innerHTML = '<div class="cn-app-install-copy"><strong>Campus Nexus App</strong><span>Access your portal from the Android app</span></div><a href="' + APP_PAGE + '" class="cn-app-install-action">Get App</a><button type="button" class="cn-app-install-close" aria-label="Dismiss app prompt">×</button>';
      const style = document.createElement('style');
      style.textContent = '#cn-app-install-prompt{position:fixed;z-index:99990;left:12px;right:12px;bottom:max(12px,env(safe-area-inset-bottom));display:flex;align-items:center;gap:12px;padding:12px 14px;background:#082f55;color:#fff;border:1px solid rgba(255,255,255,.14);border-radius:15px;box-shadow:0 10px 32px rgba(3,20,40,.28);font-family:Inter,system-ui,sans-serif}#cn-app-install-prompt .cn-app-install-copy{display:flex;flex:1;min-width:0;flex-direction:column;gap:3px}#cn-app-install-prompt strong{font-size:13px}#cn-app-install-prompt span{font-size:10px;color:#d2e1f1}#cn-app-install-prompt .cn-app-install-action{white-space:nowrap;text-decoration:none;background:#ffc52f;color:#082f55;padding:10px 13px;border-radius:9px;font-size:11px;font-weight:800}#cn-app-install-prompt .cn-app-install-close{border:0;background:transparent;color:#fff;font-size:22px;line-height:1;padding:2px 4px;cursor:pointer}@media(min-width:768px){#cn-app-install-prompt{left:auto;right:22px;bottom:22px;max-width:390px}}';
      document.head.appendChild(style);
      document.body.appendChild(bar);
      bar.querySelector('.cn-app-install-close').addEventListener('click', () => bar.remove());
    }).catch(() => {});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addInstallPrompt, { once: true });
  else addInstallPrompt();
})();
