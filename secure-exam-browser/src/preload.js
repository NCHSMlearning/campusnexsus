'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('CNSEB', Object.freeze({
  getDeviceInfo: () => ipcRenderer.invoke('cnseb:device-info'),
  requestExit: () => ipcRenderer.invoke('cnseb:request-exit'),
  requestLogout: () => ipcRenderer.invoke('cnseb:request-logout'),
  installUpdate: () => ipcRenderer.invoke('cnseb:install-update'),
  setExamScheduleStatus: payload => ipcRenderer.send('cnseb:exam-schedule-status', payload),
  onSecurityEvent: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('cnseb:device-event', listener);
    return () => ipcRenderer.removeListener('cnseb:device-event', listener);
  },
  onExitBlocked: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = () => callback();
    ipcRenderer.on('cnseb:exit-blocked', listener);
    return () => ipcRenderer.removeListener('cnseb:exit-blocked', listener);
  },
  onUpdateStatus: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('cnseb:update-status', listener);
    return () => ipcRenderer.removeListener('cnseb:update-status', listener);
  }
}));

window.addEventListener('DOMContentLoaded', async () => {
  try {
    const info = await ipcRenderer.invoke('cnseb:device-info');
    const bar = document.createElement('section');
    bar.id = 'cnseb-control-bar';
    Object.assign(bar.style, {
      position: 'fixed', top: '12px', left: '50%', transform: 'translateX(-50%)',
      zIndex: '2147483647', display: 'flex', flexWrap: 'wrap', alignItems: 'center',
      justifyContent: 'center', gap: '8px', padding: '8px 10px',
      borderRadius: '13px', background: 'rgba(5,29,52,.97)', color: '#fff',
      border: '1px solid #19b6d5', font: '700 11px/1.2 Segoe UI,Arial,sans-serif',
      boxShadow: '0 5px 22px rgba(0,0,0,.32)', maxWidth: 'calc(100vw - 24px)',
      boxSizing: 'border-box'
    });

    const brand = document.createElement('span');
    brand.textContent = 'CAMPUS NEXUS  /  SECURE EXAM';
    Object.assign(brand.style, {
      color: '#fff', fontWeight: '850', letterSpacing: '.55px',
      whiteSpace: 'nowrap', padding: '0 9px'
    });

    const status = document.createElement('span');
    status.textContent = info.strictMode ? 'Protected session' : 'Monitored session';
    Object.assign(status.style, {
      color: '#a9d8e8', fontSize: '10px', whiteSpace: 'nowrap', padding: '0 5px'
    });

    function makeButton(text, background) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text;
      Object.assign(button.style, {
        minWidth: '78px', minHeight: '36px', padding: '8px 13px',
        border: '1px solid rgba(255,255,255,.65)', borderRadius: '9px',
        background, color: '#fff', font: '800 11px/1 Segoe UI,Arial,sans-serif',
        cursor: 'pointer', whiteSpace: 'nowrap'
      });
      button.addEventListener('mouseenter', () => { button.style.filter = 'brightness(1.13)'; });
      button.addEventListener('mouseleave', () => { button.style.filter = 'none'; });
      return button;
    }

    const logout = makeButton('Logout', '#a65b12');
    const exit = makeButton('Exit', '#a92d2d');
    const update = makeButton('Update now', '#087f64');
    update.style.display = 'none';
    update.title = 'Install the downloaded Campus Nexus update and restart';
    bar.append(brand, status, logout, exit, update);
    document.documentElement.appendChild(bar);

    const shade = document.createElement('div');
    Object.assign(shade.style, {
      position: 'fixed', inset: '0', zIndex: '2147483647', display: 'none',
      alignItems: 'center', justifyContent: 'center', padding: '20px',
      background: 'rgba(3,17,31,.58)', backdropFilter: 'blur(3px)'
    });
    const panel = document.createElement('div');
    Object.assign(panel.style, {
      width: 'min(420px,100%)', padding: '25px', borderRadius: '18px',
      background: '#fff', color: '#17344d', boxShadow: '0 24px 80px #0005',
      font: '14px/1.55 Segoe UI,Arial,sans-serif'
    });
    const heading = document.createElement('h2');
    heading.style.cssText = 'margin:0 0 9px;font-size:20px;color:#082f55';
    const message = document.createElement('p');
    message.style.cssText = 'margin:0 0 20px;color:#61788d;font-size:13px';
    const controls = document.createElement('div');
    controls.style.cssText = 'display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap';
    const cancel = makeButton('Cancel', '#eaf1f6');
    cancel.style.color = '#17344d';
    cancel.style.borderColor = '#d8e4ed';
    const confirm = makeButton('Confirm', '#b42318');
    controls.append(cancel, confirm);
    panel.append(heading, message, controls);
    shade.appendChild(panel);
    document.documentElement.appendChild(shade);

    let mode = null;
    let busy = false;
    function openConfirm(nextMode) {
      if (busy) return;
      mode = nextMode;
      heading.textContent = nextMode === 'logout' ? 'Log out of Campus Nexus?' : 'Exit Secure Exam Browser?';
      message.textContent = nextMode === 'logout'
        ? 'This clears the saved sign-in for this app and closes it. Any unfinished examination will not be submitted.'
        : 'The app will close and return you to the desktop. Your sign-in will be kept for your next launch. Submit your examination first.';
      confirm.textContent = nextMode === 'logout' ? 'Logout and close' : 'Exit application';
      confirm.style.background = nextMode === 'logout' ? '#a65b12' : '#a92d2d';
      shade.style.display = 'flex';
    }
    cancel.addEventListener('click', () => { if (!busy) shade.style.display = 'none'; });
    shade.addEventListener('click', event => {
      if (event.target === shade && !busy) shade.style.display = 'none';
    });
    logout.addEventListener('click', () => openConfirm('logout'));
    exit.addEventListener('click', () => openConfirm('exit'));
    confirm.addEventListener('click', async () => {
      if (busy || !mode) return;
      busy = true;
      confirm.disabled = true;
      cancel.disabled = true;
      confirm.textContent = mode === 'logout' ? 'Clearing sign-in…' : 'Closing app…';
      message.textContent = mode === 'logout'
        ? 'Your saved app sign-in is being cleared. Please keep this window open.'
        : 'Campus Nexus Secure Exam Browser is closing.';
      try {
        const action = mode === 'logout' ? 'cnseb:request-logout' : 'cnseb:request-exit';
        const result = await Promise.race([
          ipcRenderer.invoke(action),
          new Promise((_, reject) => setTimeout(() => reject(new Error('The close request timed out. Please try again.')), 10000))
        ]);
        if (result && result.ok) {
          confirm.textContent = 'Closing…';
        } else {
          throw new Error('The app could not complete that request.');
        }
      } catch (error) {
        console.error('[CN-SEB] App control failed:', error);
        busy = false;
        confirm.disabled = false;
        cancel.disabled = false;
        confirm.textContent = mode === 'logout' ? 'Try logout again' : 'Try exit again';
        message.textContent = error.message || 'The request failed. Please try again.';
      }
    });

    update.addEventListener('click', async () => {
      update.disabled = true;
      update.textContent = 'Installing…';
      try {
        const result = await ipcRenderer.invoke('cnseb:install-update');
        if (!result || !result.ok) throw new Error('The update is not ready yet.');
      } catch (error) {
        update.disabled = false;
        update.textContent = 'Update now';
        status.textContent = error.message || 'Update could not start';
      }
    });

    ipcRenderer.on('cnseb:toolbar-schedule', (_event, payload = {}) => {
      if (payload.state === 'countdown') status.textContent = 'Exam starts in ' + String(payload.remaining || '');
      else if (payload.state === 'available') status.textContent = 'Exam is now open';
    });

    ipcRenderer.on('cnseb:update-status', (_event, payload = {}) => {
      if (payload.state === 'checking') status.textContent = 'Checking for updates…';
      else if (payload.state === 'downloading') status.textContent = 'New version found · Downloading…';
      else if (payload.state === 'progress') status.textContent = 'Downloading update · ' + payload.percent + '%';
      else if (payload.state === 'ready') {
        status.textContent = 'New version ' + (payload.version || '') + ' is ready';
        update.style.display = 'inline-block';
      } else if (payload.state === 'current') status.textContent = 'Up to date · v' + (payload.version || info.appVersion);
      else if (payload.state === 'error') status.textContent = payload.message || 'Update check failed';
    });
  } catch (error) {
    console.error('[CN-SEB] Could not initialize application controls:', error);
  }
});
