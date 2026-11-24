'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('CNSEB', Object.freeze({
  getDeviceInfo: () => ipcRenderer.invoke('cnseb:device-info'),
  requestExit: () => ipcRenderer.send('cnseb:request-exit'),
  onExitBlocked: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('cnseb:exit-blocked', listener);
    return () => ipcRenderer.removeListener('cnseb:exit-blocked', listener);
  }
}));

// Visible client indicator; it does not claim server-side exam authorization.
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const info = await ipcRenderer.invoke('cnseb:device-info');
    const badge = document.createElement('div');
    badge.textContent = info.strictMode ? 'CN-SEB · STRICT KIOSK' : 'CN-SEB · MONITORED';
    Object.assign(badge.style, {
      position: 'fixed', right: '12px', bottom: '12px', zIndex: '2147483647',
      padding: '7px 11px', borderRadius: '999px',
      background: '#082d4d', color: '#ffffff', border: '1px solid #20b7d7',
      font: '700 10px/1.2 Arial,sans-serif', letterSpacing: '.5px',
      boxShadow: '0 3px 14px rgba(0,0,0,.2)', pointerEvents: 'none'
    });
    badge.setAttribute('aria-label', 'Campus Nexus Secure Exam Browser client indicator');
    document.documentElement.appendChild(badge);
  } catch (error) {
    console.error('[CN-SEB] Could not display client indicator', error);
  }
});
