'use strict';

const { app, BrowserWindow, session, ipcMain, shell, screen } = require('electron');
const path = require('node:path');

const EXAM_ORIGIN = 'https://campusnexus.co.ke';
const EXAM_URL = `${EXAM_ORIGIN}/exam.html?client=cnseb`;
const STRICT = process.argv.includes('--strict');
let mainWindow;
let quitting = false;

if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

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

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    kiosk: STRICT,
    fullscreen: STRICT,
    title: 'Campus Nexus Secure Exam Browser',
    backgroundColor: '#071d33',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
      devTools: !app.isPackaged && !STRICT,
      partition: 'persist:cnseb-exam'
    }
  });

  // Exam links cannot create uncontrolled child windows. External help links
  // are opened in the user's default browser only for ordinary HTTP(S) URLs.
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
      (input.control && ['r', 'w', 't', 'n', 'l', 'p', 's'].includes(key)) ||
      (input.alt && ['left', 'right', 'f4', 'tab'].includes(key)) ||
      key === 'f5' || key === 'f11' || key === 'f12' ||
      (input.control && input.shift && ['i', 'j', 'c'].includes(key))
    );
    if (blocked) event.preventDefault();
  });

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[CN-SEB] Renderer process ended:', details.reason);
    if (!quitting && mainWindow && !mainWindow.isDestroyed()) mainWindow.loadURL(EXAM_URL);
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (STRICT) mainWindow.setKiosk(true);
  });

  mainWindow.on('close', event => {
    if (STRICT && !quitting) {
      event.preventDefault();
      mainWindow.webContents.send('cnseb:exit-blocked');
    }
  });

  mainWindow.loadURL(EXAM_URL);
}

app.whenReady().then(() => {
  const examSession = session.fromPartition('persist:cnseb-exam');
  examSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = ['media', 'camera', 'microphone'].includes(permission) &&
      isTrusted(webContents.getURL());
    callback(allowed);
  });
  examSession.setPermissionCheckHandler((webContents, permission, requestingOrigin) => (
    ['media', 'camera', 'microphone'].includes(permission) &&
    isTrusted(requestingOrigin || webContents.getURL())
  ));

  ipcMain.handle('cnseb:device-info', () => ({
    appVersion: app.getVersion(),
    platform: process.platform,
    architecture: process.arch,
    strictMode: STRICT,
    displayCount: screen.getAllDisplays().length
  }));

  ipcMain.on('cnseb:request-exit', () => {
    if (!STRICT) app.quit();
    else if (mainWindow) mainWindow.webContents.send('cnseb:exit-blocked');
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
