'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('CNSEB', Object.freeze({
  getDeviceInfo: () => ipcRenderer.invoke('cnseb:device-info'),
  requestExit: () => ipcRenderer.invoke('cnseb:request-exit'),
  requestLogout: () => ipcRenderer.invoke('cnseb:request-logout'),
  onExitBlocked: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('cnseb:exit-blocked', listener);
    return () => ipcRenderer.removeListener('cnseb:exit-blocked', listener);
  }
}));

// Keep the application controls large, separated and easy to reach on touch screens.
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const info = await ipcRenderer.invoke('cnseb:device-info');
    const container = document.createElement('div');
    const logo = document.createElement('img');
    logo.src = await ipcRenderer.invoke('cnseb:brand-logo-url');
    logo.alt = 'Campus Nexus';
    Object.assign(logo.style, {
      width: '30px', height: '30px', objectFit: 'contain',
      borderRadius: '6px', background: '#fff', padding: '3px', flex: '0 0 auto'
    });

    const label = document.createElement('span');
    label.textContent = info.strictMode ? 'CAMPUS NEXUS · SECURE EXAM' : 'CAMPUS NEXUS · MONITORED';
    Object.assign(label.style, {
      color: '#fff', font: '800 12px/1.3 Segoe UI,Arial,sans-serif',
      letterSpacing: '.45px', whiteSpace: 'nowrap', marginRight: '8px'
    });

    function makeActionButton(text, background, title, action) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      button.title = title;
      button.setAttribute('aria-label', title);
      Object.assign(button.style, {
        minWidth: '112px', minHeight: '44px', padding: '11px 17px',
        border: '2px solid rgba(255,255,255,.8)', borderRadius: '10px',
        background, color: '#fff', font: '800 13px/1 Segoe UI,Arial,sans-serif',
        cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 7px rgba(0,0,0,.22)',
        transition: 'filter .12s ease, transform .12s ease'
      });
      button.addEventListener('mouseenter', () => { button.style.filter = 'brightness(1.15)'; });
      button.addEventListener('mouseleave', () => { button.style.filter = 'none'; });
      button.addEventListener('click', async () => {
        if (container.dataset.busy === 'true') return;
        container.dataset.busy = 'true';
        const original = button.textContent;
        button.disabled = true;
        button.textContent = 'Please wait…';
        try { await action(); }
        catch (error) {
          console.error('[CN-SEB] App action failed:', error);
          container.dataset.busy = 'false';
          button.disabled = false;
          button.textContent = original;
        }
      });
      return button;
    }

    const logout = makeActionButton(
      'Logout', '#b45309',
      'Log out of Campus Nexus, clear this app sign-in and close the application',
      () => ipcRenderer.invoke('cnseb:request-logout')
    );
    const exit = makeActionButton(
      'Exit', '#b42318',
      'Close Campus Nexus Secure Exam Browser and return to the desktop',
      () => ipcRenderer.invoke('cnseb:request-exit')
    );

    Object.assign(container.style, {
      position: 'fixed', top: '14px', right: '18px', zIndex: '2147483647',
      display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: '14px', padding: '12px 14px', borderRadius: '14px',
      background: 'rgba(5,29,52,.97)', color: '#fff', border: '2px solid #19b6d5',
      font: '700 12px/1.2 Arial,sans-serif', boxShadow: '0 5px 22px rgba(0,0,0,.42)',
      maxWidth: 'calc(100vw - 24px)', boxSizing: 'border-box'
    });
    container.append(logo, label, logout, exit);
    container.setAttribute('aria-label', 'Campus Nexus application controls: Logout or Exit');
    document.documentElement.appendChild(container);
  } catch (error) {
    console.error('[CN-SEB] Could not initialize application controls:', error);
  }
});
