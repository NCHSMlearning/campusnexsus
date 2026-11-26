'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('CNSEB', Object.freeze({
  // This bridge exists only inside the desktop app; main.js enforces native kiosk mode.
  isKiosk: () => ipcRenderer.sendSync('cnseb:is-kiosk'),
  getDeviceInfo: () => ipcRenderer.invoke('cnseb:device-info'),
  redeemAuthHandoff: () => ipcRenderer.invoke('cnseb:redeem-auth-handoff'),
  activateWithKey: code => ipcRenderer.invoke('cnseb:activate-with-key', code),
  returnToWelcome: () => ipcRenderer.invoke('cnseb:return-to-welcome'),
  onWelcomeMessage: callback => {
    if (typeof callback !== 'function') return () => {};
    const listener = (_event, message) => callback(message);
    ipcRenderer.on('cnseb:welcome-message', listener);
    return () => ipcRenderer.removeListener('cnseb:welcome-message', listener);
  },
  getUpdateState: () => ipcRenderer.invoke('cnseb:update-state'),
  checkForUpdates: () => ipcRenderer.invoke('cnseb:check-for-updates'),
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
    const bar = document.createElement('header');
    bar.id = 'cnseb-app-header';
    Object.assign(bar.style, {
      position: 'relative', display: 'flex', flexWrap: 'nowrap', alignItems: 'center',
      justifyContent: 'space-between', gap: '12px', width: '100%', height: '64px',
      minHeight: '64px', maxHeight: '64px', overflow: 'hidden',
      padding: '8px 18px', margin: '0', boxSizing: 'border-box', flex: '0 0 64px',
      background: '#071d33', color: '#fff', borderBottom: '2px solid #19b6d5',
      font: '600 11px/1.25 Segoe UI,Arial,sans-serif'
    });

    const brand = document.createElement('div');
    Object.assign(brand.style, { display:'flex', alignItems:'center', gap:'9px', minWidth:'0', flex:'0 0 auto', padding:'2px 4px' });
    const brandLogo = document.createElement('img');
    brandLogo.src = 'https://campusnexus.co.ke/images/campus-nexus-original-logo.webp';
    brandLogo.alt = 'Campus Nexus';
    Object.assign(brandLogo.style, { width:'30px', height:'30px', objectFit:'contain', borderRadius:'7px', background:'#fff', padding:'3px', flex:'0 0 auto' });
    const brandText = document.createElement('span');
    brandText.textContent = 'CAMPUS NEXUS  /  SECURE EXAM';
    Object.assign(brandText.style, { fontWeight:'850', letterSpacing:'.45px', whiteSpace:'nowrap', fontSize:'12px' });
    brand.append(brandLogo, brandText);

    const statusGroup = document.createElement('div');
    Object.assign(statusGroup.style, {
      display: 'flex', flexWrap: 'wrap', alignItems: 'center',
      justifyContent: 'flex-end', gap: '6px', minWidth: '0', flex: '1 1 auto', flexWrap: 'nowrap', overflow: 'hidden'
    });
    const sessionStatus = document.createElement('span');
    sessionStatus.textContent = info.kioskRuntime ? 'Desktop app · kiosk window' : 'Desktop app · monitored window';
sessionStatus.title = 'App-level kiosk presentation only. Institution-managed Windows compliance is not verified by this client.';
    sessionStatus.style.cssText = 'color:#a9d8e8;font-size:11px;padding:5px 7px';
    const versionStatus = document.createElement('span');
    versionStatus.textContent = 'Installed v' + (info.appVersion || 'unknown');
    versionStatus.title = 'Version currently installed on this computer';
    versionStatus.style.cssText = 'color:#d9eaf2;font-size:11px;padding:5px 7px';
    const updateStatus = document.createElement('span');
    updateStatus.textContent = 'Checking for updates…';
    updateStatus.style.cssText = 'color:#b8d7e5;font-size:10px;padding:5px 6px;max-width:340px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
    statusGroup.append(sessionStatus, versionStatus, updateStatus);

    function makeButton(label, background) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      Object.assign(button.style, {
        minHeight: '34px', padding: '7px 12px', border: '1px solid #6c879b',
        borderRadius: '8px', background, color: '#fff',
        font: '700 11px Segoe UI,Arial,sans-serif', cursor: 'pointer',
        whiteSpace: 'nowrap'
      });
      return button;
    }
    const check = makeButton('Check updates', '#14506a');
    const update = makeButton('Update and restart', '#087f64');
    update.style.display = 'none';
    const logout = makeButton('Log out', '#8b5319');
    const exit = makeButton('Exit app', '#8f3030');
    // Do not expose controls that can interrupt an examination. Main-process
    // IPC guards independently enforce this even if a page calls the bridge.
    if (info.kioskRuntime) {
      check.style.display = 'none';
      update.style.display = 'none';
      logout.style.display = 'none';
      exit.style.display = 'none';
    }
    statusGroup.append(check, update, logout, exit);
    bar.append(brand, statusGroup);

    // Insert a normal-flow application header. It is part of the page layout,
    // not a fixed/floating overlay over examination content.
    const mount = document.body || document.documentElement;
    mount.insertBefore(bar, mount.firstChild);

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
    document.body.appendChild(shade);

    let mode = null;
    let busy = false;
    function openConfirm(nextMode) {
      if (busy) return;
      mode = nextMode;
      heading.textContent = nextMode === 'logout' ? 'Log out of Campus Nexus?' : 'Exit Secure Exam Browser?';
      message.textContent = nextMode === 'logout'
        ? 'This clears the saved sign-in for this app and closes it. Any unfinished examination will not be submitted.'
        : 'The app will close and return you to the desktop. Your sign-in will be kept for your next launch. Submit your examination first.';
      confirm.textContent = nextMode === 'logout' ? 'Log out and close' : 'Exit application';
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
        if (!result || !result.ok) throw new Error(result && result.message || 'The app could not complete that request.');
        confirm.textContent = 'Closing…';
      } catch (error) {
        busy = false;
        confirm.disabled = false;
        cancel.disabled = false;
        confirm.textContent = mode === 'logout' ? 'Try logout again' : 'Try exit again';
        message.textContent = error.message || 'The request failed. Please try again.';
      }
    });

    async function checkForUpdates() {
      check.disabled = true;
      check.textContent = 'Checking…';
      try {
        const result = await ipcRenderer.invoke('cnseb:check-for-updates');
        if (!result || !result.ok) throw new Error(result && result.reason || 'Update check unavailable');
      } catch (error) {
        updateStatus.textContent = error.message || 'Update check failed';
      } finally {
        check.disabled = false;
        check.textContent = 'Check updates';
      }
    }
    check.addEventListener('click', checkForUpdates);
    update.addEventListener('click', async () => {
      update.disabled = true;
      update.textContent = 'Restarting…';
      try {
        const result = await ipcRenderer.invoke('cnseb:install-update');
        if (!result || !result.ok) throw new Error(result && result.message || 'The update is not ready yet.');
      } catch (error) {
        update.disabled = false;
        update.textContent = 'Update and restart';
        updateStatus.textContent = error.message || 'Update could not start';
      }
    });

    const renderUpdateStatus = payload => {
      if (!payload) return;
      const installed = payload.installedVersion || info.appVersion || 'unknown';
      const latest = payload.latestVersion || payload.version || null;
      versionStatus.textContent = 'Installed v' + installed + (latest ? ' · Latest v' + latest : '');
      const checked = payload.lastCheckedAt
        ? new Date(payload.lastCheckedAt).toLocaleString()
        : 'Not checked yet';
      if (payload.state === 'checking') updateStatus.textContent = 'Checking for updates… · Last successful check: ' + checked;
      else if (payload.state === 'downloading') updateStatus.textContent = 'Downloading v' + (latest || 'update') + '… · Last check: ' + checked;
      else if (payload.state === 'progress') updateStatus.textContent = 'Downloading update · ' + (payload.percent || 0) + '% · Last check: ' + checked;
      else if (payload.state === 'ready') {
        updateStatus.textContent = 'Update v' + (latest || '') + ' ready to install · Last check: ' + checked;
        if (!info.kioskRuntime) update.style.display = 'inline-block';
      } else if (payload.state === 'current') updateStatus.textContent = 'Up to date · Last successful check: ' + checked;
      else if (payload.state === 'error') updateStatus.textContent = (payload.message || 'Update check failed') + ' · Last successful check: ' + checked;
    };
    ipcRenderer.on('cnseb:update-status', (_event, payload = {}) => renderUpdateStatus(payload));
    ipcRenderer.on('cnseb:toolbar-schedule', (_event, payload = {}) => {
      sessionStatus.textContent = payload.state === 'countdown'
        ? 'Exam starts in ' + String(payload.remaining || '')
        : 'Exam is now open';
    });
    renderUpdateStatus(await ipcRenderer.invoke('cnseb:update-state'));
  } catch (error) {
    console.error('[CN-SEB] Could not initialize application controls:', error);
  }
});
