'use strict';

const { app, BrowserWindow, session, ipcMain, shell, screen, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');

const EXAM_ORIGIN = 'https://campusnexus.co.ke';
const DEFAULT_EXAM_URL = `${EXAM_ORIGIN}/exam.html?client=cnseb`;
// Packaged Windows builds launch in strict kiosk mode by default. Use --standard only for controlled testing.
const STRICT = app.isPackaged || process.argv.includes('--strict');
const PROTOCOL = 'campusnexus-seb:';
let mainWindow;
let quitting = false;
let pendingExamUrl = null;
let updateNoticeShown = false;

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

function openSafeExternal(url) {
  try {
    const parsed = new URL(url);
    if (['https:', 'http:'].includes(parsed.protocol)) shell.openExternal(parsed.href);
  } catch { /* Ignore malformed destinations. */ }
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
    autoHideMenuBar: true, kiosk: true, fullscreen: true, frame: false,
    resizable: false, maximizable: false, minimizable: !STRICT, closable: !STRICT,
    skipTaskbar: true, alwaysOnTop: true,
    title: 'Campus Nexus Secure Exam Browser',
    backgroundColor: '#071d33',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
      webSecurity: true, allowRunningInsecureContent: false,
      spellcheck: false, devTools: !app.isPackaged && !STRICT,
      partition: 'persist:cnseb-exam'
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isTrusted(url)) openSafeExternal(url);
    return { action: 'deny' };
  });
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
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.setKiosk(true);
    mainWindow.setFullScreen(true);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    if (pendingExamUrl) {
      const target = pendingExamUrl;
      pendingExamUrl = null;
      loadExam(target);
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
  loadExam(initialTarget);
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
  app.setAsDefaultProtocolClient('campusnexus-seb');
  const examSession = session.fromPartition('persist:cnseb-exam');
  examSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(['media','camera','microphone'].includes(permission) && isTrusted(webContents.getURL()));
  });
  examSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => (
    ['media','camera','microphone'].includes(permission) &&
    isTrusted(requestingOrigin || webContents.getURL())
  ));
  ipcMain.handle('cnseb:device-info', () => ({
    appVersion: app.getVersion(), platform: process.platform,
    architecture: process.arch, strictMode: STRICT,
    displayCount: screen.getAllDisplays().length
  }));
  ipcMain.on('cnseb:request-exit', () => {
    if (!STRICT) app.quit();
    else if (mainWindow) mainWindow.webContents.send('cnseb:exit-blocked');
  });
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
