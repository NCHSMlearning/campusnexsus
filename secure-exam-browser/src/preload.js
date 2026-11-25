'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('CNSEB', Object.freeze({
  getDeviceInfo: () => ipcRenderer.invoke('cnseb:device-info'),
  requestExit: () => ipcRenderer.invoke('cnseb:request-exit'),
  onExitBlocked: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('cnseb:exit-blocked', listener);
    return () => ipcRenderer.removeListener('cnseb:exit-blocked', listener);
  }
}));

// Branded application badge and an explicit, confirmed exit-to-desktop control.
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const info = await ipcRenderer.invoke('cnseb:device-info');
    const container = document.createElement('div');
    const logo = document.createElement('img');
    logo.src = 'https://campusnexus.co.ke/images/campus-nexus-original-logo.webp';
    logo.alt = 'Campus Nexus';
    Object.assign(logo.style, { width: '22px', height: '22px', objectFit: 'contain', borderRadius: '5px', background: '#fff', padding: '2px' });

    const label = document.createElement('span');
    label.textContent = info.strictMode ? 'CAMPUS NEXUS · SECURE EXAM' : 'CAMPUS NEXUS · MONITORED';

    const exit = document.createElement('button');
    exit.type = 'button';
    exit.textContent = 'Exit / Logout';
    exit.title = 'Close Campus Nexus Secure Exam Browser and return to the desktop';
    Object.assign(exit.style, {
      border: '1px solid rgba(255,255,255,.35)', borderRadius: '999px',
      background: '#b42318', color: '#fff', padding: '7px 11px',
      font: '700 11px Arial,sans-serif', cursor: 'pointer'
    });
    exit.addEventListener('click', () => {
      exit.disabled = true;
      exit.textContent = 'Please wait…';
      ipcRenderer.invoke('cnseb:request-exit').finally(() => {
        exit.disabled = false;
        exit.textContent = 'Exit / Logout';
      });
    });

    Object.assign(container.style, {
      position: 'fixed', right: '14px', bottom: '14px', zIndex: '2147483647',
      display: 'flex', alignItems: 'center', gap: '9px',
      padding: '8px 10px', borderRadius: '999px',
      background: '#082f55', color: '#fff', border: '1px solid #19b6d5',
      font: '700 10px/1.2 Arial,sans-serif', letterSpacing: '.35px',
      boxShadow: '0 3px 14px rgba(0,0,0,.25)'
    });
    container.append(logo, label, exit);
    container.setAttribute('aria-label', 'Campus Nexus Secure Examination application controls');
    document.documentElement.appendChild(container);
  } catch (error) {
    console.error('[CN-SEB] Could not initialize application controls:', error);
  }
});
