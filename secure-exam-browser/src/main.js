'use strict';

const { app, BrowserWindow, session, ipcMain, screen, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const EXAM_ORIGIN = 'https://campusnexus.co.ke';
const SUPABASE_URL = 'https://irahplkvocaakjxuisto.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_5Cg5FFudf03UnmOXGNGMHQ_uK9S-uQX';
const HANDOFF_ENDPOINT = `${SUPABASE_URL}/functions/v1/cnseb-auth-handoff`;
const DEFAULT_EXAM_URL = `${EXAM_ORIGIN}/exam.html?client=cnseb`;
// Packaged Windows builds always launch in strict kiosk mode.
const STRICT = app.isPackaged || process.argv.includes('--strict');
const PROTOCOL = 'campusnexus-seb:';
let mainWindow;
let quitting = false;
let pendingExamUrl = null;
let pendingHandoffCode = null;
let updateState = { state: 'checking' };
let exitInProgress = false;

function isValidExamUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === 'campusnexus.co.ke' &&
      ['/exam.html', '/exam', '/exam/'].includes(url.pathname.toLowerCase());
  } catch { return false; }
}

function extractExamUrl(args) {
  for (const arg of args || []) {
    if (typeof arg !== 'string' || !arg.toLowerCase().startsWith(PROTOCOL)) continue;
    try {
      const deepLink = new URL(arg);
      const candidate = deepLink.searchParams.get('url');
      if (isValidExamUrl(candidate)) return candidate;
    } catch { /* Ignore invalid protocol arguments. */ }
  }
  return null;
}

function isTrusted(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'campusnexus.co.ke';
  } catch { return false; }
}

function loadExam(url) {
  const target = isValidExamUrl(url) ? url : DEFAULT_EXAM_URL;
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(target);
  else pendingExamUrl = target;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    show: false,
    // Exam client always occupies the full display; packaged builds are strict by default.
    autoHideMenuBar: true, kiosk: true, fullscreen: true, fullscreenable: true, frame: false,
    resizable: false, maximizable: false, minimizable: false, closable: !STRICT,
    titleBarStyle: 'hidden',
    skipTaskbar: false, alwaysOnTop: true,
    title: 'Campus Nexus | Secure Examination',
    icon: path.join(__dirname, '../build/campus-nexus.ico'),
    backgroundColor: '#071d33',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      webSecurity: true, allowRunningInsecureContent: false,
      spellcheck: false, devTools: !app.isPackaged && !STRICT,
      partition: 'persist:cnseb-exam'
    }
  });

  const sendDeviceEvent = (eventType, details = {}) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('cnseb:device-event', {
        eventType, details, timestamp: new Date().toISOString()
      });
    }
  };
  screen.on('display-added', (_event, display) => sendDeviceEvent('external_display_added', {
    displayId: display.id, bounds: display.bounds, scaleFactor: display.scaleFactor
  }));
  screen.on('display-removed', (_event, display) => sendDeviceEvent('external_display_removed', {
    displayId: display.id
  }));
  screen.on('display-metrics-changed', (_event, display, changedMetrics) => sendDeviceEvent('display_metrics_changed', {
    displayId: display.id, changedMetrics
  }));
  mainWindow.on('blur', () => sendDeviceEvent('application_focus_lost'));
  mainWindow.on('focus', () => sendDeviceEvent('application_focus_returned'));

  // Dashboard cards may use target="_blank". Keep trusted Campus Nexus
  // navigation inside the protected app instead of silently denying clicks.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const examTarget = extractExamUrl([url]);
    if (examTarget) setImmediate(() => loadExam(examTarget));
    else if (isTrusted(url)) setImmediate(() => {
      if (mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(url);
    });
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const examTarget = extractExamUrl([url]);
    if (examTarget) { event.preventDefault(); loadExam(examTarget); return; }
    if (!isTrusted(url)) event.preventDefault();
  });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const key = input.key.toLowerCase();
    const blocked = input.type === 'keyDown' && (
      (input.control && ['r','w','t','n','l','p','s','c','v','x'].includes(key)) ||
      (input.alt && ['left','right','f4','tab'].includes(key)) ||
      key === 'f5' || key === 'f11' || key === 'f12' ||
      (input.control && input.shift && ['i','j','c'].includes(key))
    );
    if (blocked) event.preventDefault();
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[CN-SEB] Renderer process ended:', details.reason);
    if (!quitting && mainWindow && !mainWindow.isDestroyed()) loadExam(pendingExamUrl || DEFAULT_EXAM_URL);
  });
  const enforceKioskDisplay = () => {
    if (!mainWindow || mainWindow.isDestroyed() || !STRICT) return;
    const display = screen.getDisplayMatching(mainWindow.getBounds());
    // Explicitly cover the active monitor before entering kiosk mode. This also
    // avoids retaining stale windowed bounds from an earlier app version.
    mainWindow.setBounds(display.bounds, false);
    mainWindow.setMenuBarVisibility(false);
    mainWindow.setKiosk(true);
    mainWindow.setFullScreen(true);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  };

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    enforceKioskDisplay();
    if (pendingExamUrl) {
      const target = pendingExamUrl;
      pendingExamUrl = null;
      loadExam(target);
    }
  });
  mainWindow.on('leave-full-screen', () => {
    if (STRICT && !quitting) setImmediate(enforceKioskDisplay);
  });
  mainWindow.on('minimize', event => {
    if (STRICT && !quitting) {
      event.preventDefault();
      setImmediate(() => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.restore(); enforceKioskDisplay(); });
    }
  });
  mainWindow.on('close', event => {
    if (STRICT && !quitting) {
      event.preventDefault();
      mainWindow.webContents.send('cnseb:exit-blocked');
    }
  });
  // Preserve the requested exam URL until the splash screen has loaded.
  // A protocol hand-off can arrive during startup; it must win over the default.
  const initialTarget = pendingExamUrl;
  pendingExamUrl = null;
  let splashResolved = false;
  const resolveStartupDestination = () => {
    if (splashResolved || quitting || !mainWindow || mainWindow.isDestroyed()) return;
    splashResolved = true;
    const target = pendingExamUrl || initialTarget || DEFAULT_EXAM_URL;
    pendingExamUrl = null;
    loadExam(target);
  };
  mainWindow.webContents.once('did-finish-load', resolveStartupDestination);
  mainWindow.loadFile(path.join(__dirname, 'splash.html')).catch(error => {
    console.error('[CN-SEB] Startup screen failed:', error);
    resolveStartupDestination();
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  const initialLaunch = extractLaunch(process.argv);\n  pendingExamUrl = initialLaunch?.url || null;\n  pendingHandoffCode = initialLaunch?.code || null;
  app.on('second-instance', (_event, commandLine) => {
    const target = extractExamUrl(commandLine);
    if (target) pendingExamUrl = target;
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (target) loadExam(target);
    }
  });
  app.on('open-url', (event, url) => {
    event.preventDefault();
    const target = extractExamUrl([url]);
    if (target) {
      pendingExamUrl = target;
      if (mainWindow) loadExam(target);
    }
  });
}

app.whenReady().then(() => {
  app.setName('Campus Nexus Secure Exam Browser');
  if (process.platform === 'win32') app.setAppUserModelId('co.ke.campusnexus.secureexam');
  app.setAsDefaultProtocolClient('campusnexus-seb');
  const examSession = session.fromPartition('persist:cnseb-exam');
  examSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(['media','camera','microphone'].includes(permission) && isTrusted(webContents.getURL()));
  });
  examSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => (
    ['media','camera','microphone'].includes(permission) &&
    isTrusted(requestingOrigin || webContents.getURL())
  ));
  ipcMain.handle('cnseb:brand-logo-url', () => pathToFileURL(path.join(__dirname, '../build/campus-nexus-original-logo.webp')).href);
  ipcMain.handle('cnseb:update-state', () => updateState);\n  ipcMain.handle('cnseb:redeem-auth-handoff', async (event) => {\n    const frameUrl = event.senderFrame?.url || '';\n    if (!isValidExamUrl(frameUrl)) return { ok: false, error: 'Authentication handoff is only available on the verified exam page.' };\n    const code = pendingHandoffCode;\n    if (!code) return { ok: false, unavailable: true };\n    pendingHandoffCode = null;\n    try {\n      const response = await fetch(HANDOFF_ENDPOINT, {\n        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },\n        body: JSON.stringify({ action: 'redeem', code }), signal: AbortSignal.timeout(12000)\n      });\n      const payload = await response.json().catch(() => ({}));\n      if (!response.ok || !payload.token_hash || !payload.exam_id) return { ok: false, error: payload.error || 'Secure sign-in could not be completed. Return to the student portal and launch again.' };\n      const current = new URL(frameUrl);\n      if (current.searchParams.get('exam_id') !== String(payload.exam_id)) return { ok: false, error: 'This sign-in code does not belong to the selected examination.' };\n      return { ok: true, token_hash: payload.token_hash, type: 'magiclink', exam_id: String(payload.exam_id) };\n    } catch (error) {\n      console.error('[CN-SEB] Authentication handoff failed:', error.message);\n      return { ok: false, error: 'Unable to connect to secure sign-in. Check the internet connection and relaunch the examination.' };\n    }\n  });
  ipcMain.on('cnseb:is-kiosk', event => {
    event.returnValue = !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isKiosk() && mainWindow.isFullScreen());
  });
  ipcMain.handle('cnseb:device-info', () => ({
    appVersion: app.getVersion(), platform: process.platform,
    architecture: process.arch, strictMode: STRICT,
    displayCount: screen.getAllDisplays().length
  }));
  // Use an in-app confirmation rather than a native modal hidden behind kiosk.
  ipcMain.handle('cnseb:request-exit', async () => {
    if (quitting) return { ok: true };
    exitInProgress = true;
    quitting = true;
    setTimeout(() => app.exit(0), 150);
    return { ok: true };
  });
  ipcMain.handle('cnseb:request-logout', async () => {
    if (quitting) return { ok: true };
    exitInProgress = true;
    try {
      const examSession = session.fromPartition('persist:cnseb-exam');
      await Promise.race([
        examSession.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage'] }),
        new Promise(resolve => setTimeout(resolve, 7000))
      ]);
      await examSession.clearCache().catch(() => {});
    } catch (error) {
      console.error('[CN-SEB] Logout cleanup warning:', error);
    } finally {
      quitting = true;
      setTimeout(() => app.exit(0), 150);
    }
    return { ok: true };
  });
  ipcMain.on('cnseb:exam-schedule-status', (_event, payload = {}) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const safe = payload && payload.state === 'countdown'
      ? { state: 'countdown', remaining: String(payload.remaining || '').slice(0, 24) }
      : { state: 'available' };
    mainWindow.webContents.send('cnseb:toolbar-schedule', safe);
  });
  ipcMain.handle('cnseb:check-for-updates', async () => {
    if (!app.isPackaged) return { ok: false, reason: 'not-packaged' };
    try { await autoUpdater.checkForUpdates(); return { ok: true }; }
    catch (error) { return { ok: false, reason: error.message }; }
  });
  ipcMain.handle('cnseb:install-update', () => {
    if (!app.isPackaged) return { ok: false, reason: 'not-packaged' };
    autoUpdater.quitAndInstall(true, true);
    return { ok: true };
  });
  createWindow();

  // Always check the published GitHub release as soon as the packaged app starts.
  // Downloads are silent; installation waits until the student chooses Update now
  // or closes the app, so an active examination is never interrupted.
  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    const publishUpdateState = payload => {
      updateState = { ...payload, checkedAt: new Date().toISOString() };
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('cnseb:update-status', updateState);
      }
    };
    autoUpdater.on('checking-for-update', () => publishUpdateState({ state: 'checking' }));
    autoUpdater.on('update-available', info => {
      console.log('[CN-SEB] Update available:', info.version);
      publishUpdateState({ state: 'downloading', version: info.version });
    });
    autoUpdater.on('update-not-available', info => {
      console.log('[CN-SEB] App is up to date:', info.version);
      publishUpdateState({ state: 'current', version: info.version });
    });
    autoUpdater.on('download-progress', progress => publishUpdateState({
      state: 'progress', percent: Math.round(progress.percent || 0)
    }));
    autoUpdater.on('update-downloaded', info => {
      console.log('[CN-SEB] Update downloaded:', info.version);
      publishUpdateState({ state: 'ready', version: info.version });
    });
    autoUpdater.on('error', error => {
      console.error('[CN-SEB] Update check failed:', error.message);
      publishUpdateState({
        state: 'error',
        message: 'Update check failed. Check your internet connection and try again.'
      });
    });
    const checkForUpdates = () => {
      if (quitting) return;
      publishUpdateState({ state: 'checking' });
      autoUpdater.checkForUpdates().catch(error => {
        console.error('[CN-SEB] Update check failed:', error.message);
      });
    };
    // Run immediately on every app launch, then refresh the release feed every hour.
    checkForUpdates();
    setInterval(checkForUpdates, 60 * 60 * 1000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    if (app.isPackaged) autoUpdater.checkForUpdates().catch(error => console.error('[CN-SEB] Update recheck failed:', error.message));
  });
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
