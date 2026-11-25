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
    const logo = document.createElement('img');
    logo.src = 'https://campusnexus.co.ke/images/campus-nexus-original-logo.webp';
    logo.alt = 'Campus Nexus';
    logo.width = 20;
    logo.height = 20;
    Object.assign(logo.style, { width: '20px', height: '20px', objectFit: 'contain', borderRadius: '5px', background: '#fff', padding: '2px' });
    const label = document.createElement('span');
    label.textContent = info.strictMode ? 'CAMPUS NEXUS · SECURE EXAM' : 'CAMPUS NEXUS · MONITORED';
    badge.append(logo, label);
    Object.assign(badge.style, {
      position: 'fixed', right: '12px', bottom: '12px', zIndex: '2147483647',
      display: 'flex', alignItems: 'center', gap: '8px',
      padding: '7px 12px', borderRadius: '999px',
      background: '#082f55', color: '#ffffff', border: '1px solid #19b6d5',
      font: '700 10px/1.2 Arial,sans-serif', letterSpacing: '.5px',
      boxShadow: '0 3px 14px rgba(0,0,0,.2)', pointerEvents: 'none'
    });
    badge.setAttribute('aria-label', 'Campus Nexus Secure Examination desktop application');
    document.documentElement.appendChild(badge);
  } catch (error) {
    console.error('[CN-SEB] Could not display client indicator', error);
  }
});
