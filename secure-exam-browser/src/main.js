'use strict';

const { app, BrowserWindow, session, ipcMain, screen, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const EXAM_ORIGIN = 'https://campusnexus.co.ke';
const DEFAULT_EXAM_URL = `${EXAM_ORIGIN}/exam.html?client=cnseb`;
// Packaged Windows builds always launch in strict kiosk mode.
const STRICT = app.isPackaged || process.argv.includes('--strict');
const PROTOCOL = 'campusnexus-seb:';
let mainWindow;
let quitting = false;
let pendingExamUrl = null;
let updateNoticeShown = false;
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

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!isTrusted(url)) event.preventDefault();
  });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.webContents.on('before-input-event', (event, input) => {
    const key = input.key.toLowerCase();
    const blocked = input.type === 'keyDown' && (
      (input.control && ['r','w','t','n','l','p','s'].includes(key)) ||
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
  const initialTarget = pendingExamUrl || DEFAULT_EXAM_URL;
  pendingExamUrl = null;
  // Display a branded native startup screen first, then initialize the exam portal.
  mainWindow.webContents.once('did-finish-load', () => {
    if (!quitting && mainWindow && !mainWindow.isDestroyed()) loadExam(initialTarget);
  });
  mainWindow.loadFile(path.join(__dirname, 'splash.html')).catch(error => {
    console.error('[CN-SEB] Startup screen failed:', error);
    loadExam(initialTarget);
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  pendingExamUrl = extractExamUrl(process.argv);
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
  ipcMain.handle('cnseb:device-info', () => ({
    appVersion: app.getVersion(), platform: process.platform,
    architecture: process.arch, strictMode: STRICT,
    displayCount: screen.getAllDisplays().length
  }));
  async function confirmClose(mode) {
    if (exitInProgress) return false;
    const isLogout = mode === 'logout';
    const result = await dialog.showMessageBox(mainWindow && !mainWindow.isDestroyed() ? mainWindow : undefined, {
      type: 'warning',
      title: isLogout ? 'Logout of Campus Nexus?' : 'Exit Campus Nexus Secure Exam Browser?',
      message: isLogout
        ? 'You will be logged out and the application will close completely.'
        : 'The application will close completely and return you to the desktop.',
      detail: isLogout
        ? 'Your Campus Nexus sign-in session on this app will be cleared. Any unfinished examination will not be submitted.'
        : 'Your sign-in session will be kept for your next launch. Make sure you have submitted your examination before exiting.',
      buttons: ['Cancel', isLogout ? 'Logout and Close' : 'Exit Application'],
      defaultId: 0, cancelId: 0, noLink: true
    });
    if (result.response !== 1) return false;
    exitInProgress = true;
    quitting = true;
    if (isLogout) {
      try {
        await session.fromPartition('persist:cnseb-exam').clearStorageData({
          storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage']
        });
      } catch (error) {
        console.error('[CN-SEB] Could not clear sign-in state on logout:', error);
      }
    }
    app.quit();
    return true;
  }
  ipcMain.handle('cnseb:request-exit', () => confirmClose('exit'));
  ipcMain.handle('cnseb:request-logout', () => confirmClose('logout'));
  createWindow();

  // Updates are downloaded in the background and installed only after the
  // student exits the app; an active examination is never forcibly restarted.
  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    autoUpdater.on('error', error => console.error('[CN-SEB] Update check failed:', error.message));
    autoUpdater.on('update-available', info => console.log('[CN-SEB] Update available:', info.version));
    autoUpdater.on('update-not-available', info => console.log('[CN-SEB] App is up to date:', info.version));
    autoUpdater.on('update-downloaded', async info => {
      console.log('[CN-SEB] Update downloaded; it will install after the app is closed.');
      if (updateNoticeShown || !mainWindow || mainWindow.isDestroyed()) return;
      updateNoticeShown = true;
      await dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Campus Nexus update ready',
        message: 'A new Secure Exam Browser update has been downloaded.',
        detail: 'It will install automatically after you close the application. Your current examination will not be interrupted.',
        buttons: ['Continue']
      });
    });
    const checkForUpdates = () => autoUpdater.checkForUpdatesAndNotify().catch(error =>
      console.error('[CN-SEB] Could not check for updates:', error.message)
    );
    setTimeout(checkForUpdates, 15000);
    setInterval(checkForUpdates, 6 * 60 * 60 * 1000);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
