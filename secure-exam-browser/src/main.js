'use strict';

const { app, BrowserWindow, session, ipcMain, screen, dialog, Menu, safeStorage } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const os = require('node:os');
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
let currentExamUrl = null;
let pendingHandoffCode = null;
let pendingRedeemedHandoff = null;
let updateState = { state: 'checking', installedVersion: app.getVersion(), latestVersion: null, lastCheckedAt: null };
let exitInProgress = false;
let examMode = false;
let deviceInstallId = null;
let deviceRegistration = null;
let encryptedDraftWriteQueue = Promise.resolve();

function encryptedDraftPath(examId, studentId, attemptId) {
  const identity = [String(examId), String(studentId), String(attemptId)].join(':');
  const name = crypto.createHash('sha256').update(identity).digest('hex');
  return path.join(app.getPath('userData'), 'encrypted-attempt-drafts', `${name}.bin`);
}

function isTrustedExamSender(event) {
  return isValidExamUrl(event.senderFrame?.url || '');
}

async function writeEncryptedDraft(event, payload) {
  if (!isTrustedExamSender(event) || !safeStorage.isEncryptionAvailable()) return { ok: false, reason: 'secure-storage-unavailable' };
  const examId = String(payload?.examId || '');
  const studentId = String(payload?.studentId || '');
  const attemptId = String(payload?.attemptId || '');
  const key = String(payload?.key || '');
  if (!/^\\d+$/.test(examId) || !/^[0-9a-f-]{36}$/i.test(studentId) ||
      !/^[0-9a-f-]{36}$/i.test(attemptId) || !/^(draft_[0-9a-f-]{36}|progress|flagged)$/i.test(key)) {
    return { ok: false, reason: 'invalid-draft-scope' };
  }
  const serialized = JSON.stringify(payload.data);
  if (Buffer.byteLength(serialized, 'utf8') > 100000) return { ok: false, reason: 'draft-too-large' };
  const file = encryptedDraftPath(examId, studentId, attemptId);
  encryptedDraftWriteQueue = encryptedDraftWriteQueue.then(async () => {
    let vault = { version: 1, examId, studentId, attemptId, records: {} };
    try {
      const encrypted = fs.readFileSync(file);
      vault = JSON.parse(safeStorage.decryptString(encrypted));
      if (vault.examId !== examId || vault.studentId !== studentId || vault.attemptId !== attemptId || vault.version !== 1) {
        vault = { version: 1, examId, studentId, attemptId, records: {} };
      }
    } catch (_) {}
    vault.records[key] = payload.data;
    const encrypted = safeStorage.encryptString(JSON.stringify(vault));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, encrypted, { mode: 0o600 });
    fs.renameSync(temporary, file);
  });
  try { await encryptedDraftWriteQueue; return { ok: true }; }
  catch (error) { console.error('[CN-SEB] Encrypted draft write failed:', error.message); return { ok: false, reason: 'write-failed' }; }
}

function readEncryptedDraft(event, payload) {
  if (!isTrustedExamSender(event) || !safeStorage.isEncryptionAvailable()) return { ok: false, reason: 'secure-storage-unavailable' };
  const examId = String(payload?.examId || ''), studentId = String(payload?.studentId || ''), attemptId = String(payload?.attemptId || '');
  if (!/^\\d+$/.test(examId) || !/^[0-9a-f-]{36}$/i.test(studentId) || !/^[0-9a-f-]{36}$/i.test(attemptId)) return { ok: false, reason: 'invalid-draft-scope' };
  try {
    const vault = JSON.parse(safeStorage.decryptString(fs.readFileSync(encryptedDraftPath(examId, studentId, attemptId))));
    if (vault.version !== 1 || vault.examId !== examId || vault.studentId !== studentId || vault.attemptId !== attemptId) return { ok: false, reason: 'scope-mismatch' };
    return { ok: true, records: vault.records || {} };
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('[CN-SEB] Encrypted draft recovery unavailable:', error.message);
    return { ok: true, records: {} };
  }
}

async function clearEncryptedDraft(event, payload) {
  if (!isTrustedExamSender(event)) return { ok: false, reason: 'untrusted-sender' };
  const examId = String(payload?.examId || ''), studentId = String(payload?.studentId || ''), attemptId = String(payload?.attemptId || '');
  if (!/^\\d+$/.test(examId) || !/^[0-9a-f-]{36}$/i.test(studentId) || !/^[0-9a-f-]{36}$/i.test(attemptId)) return { ok: false, reason: 'invalid-draft-scope' };
  await encryptedDraftWriteQueue;
  try { fs.rmSync(encryptedDraftPath(examId, studentId, attemptId), { force: true }); return { ok: true }; }
  catch (error) { return { ok: false, reason: 'clear-failed' }; }
}

function loadDeviceIdentity() {
  const directory = app.getPath('userData');
  fs.mkdirSync(directory, { recursive: true });
  const identityPath = path.join(directory, 'device-identity.json');
  let saved = {};
  try { saved = JSON.parse(fs.readFileSync(identityPath, 'utf8')); } catch (_) {}
  deviceInstallId = /^[0-9a-f-]{36}$/i.test(saved.installId || '') ? saved.installId : crypto.randomUUID();
  deviceRegistration = saved.registration && typeof saved.registration.id === 'string' ? saved.registration : null;
  fs.writeFileSync(identityPath, JSON.stringify({ installId: deviceInstallId, registration: deviceRegistration }, null, 2), { mode: 0o600 });
}

function saveDeviceRegistration(registration) {
  deviceRegistration = registration;
  const identityPath = path.join(app.getPath('userData'), 'device-identity.json');
  fs.writeFileSync(identityPath, JSON.stringify({ installId: deviceInstallId, registration: deviceRegistration }, null, 2), { mode: 0o600 });
}

function isValidExamUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === 'campusnexus.co.ke' &&
      ['/exam.html', '/exam', '/exam/'].includes(url.pathname.toLowerCase());
  } catch { return false; }
}

function extractLaunch(args) {
  for (const arg of args || []) {
    if (typeof arg !== 'string' || !arg.toLowerCase().startsWith(PROTOCOL)) continue;
    try {
      const deepLink = new URL(arg);
      const candidate = deepLink.searchParams.get('url');
      const code = deepLink.searchParams.get('code');
      if (isValidExamUrl(candidate)) return { url: candidate, code: /^[A-HJ-NP-Z2-9]{12}$/.test(String(code || '').toUpperCase()) ? String(code).toUpperCase() : null };
    } catch { /* Ignore invalid protocol arguments. */ }
  }
  return null;
}

function extractExamUrl(args) { return extractLaunch(args)?.url || null; }

function isTrusted(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'campusnexus.co.ke';
  } catch { return false; }
}

function applyWindowMode(url) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const nextExamMode = STRICT && isValidExamUrl(url);
  examMode = nextExamMode;
  if (nextExamMode) {
    mainWindow.setMenuBarVisibility(false);
    mainWindow.setKiosk(true);
    mainWindow.setFullScreen(true);
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
    if (typeof mainWindow.setClosable === 'function') mainWindow.setClosable(false);
    if (typeof mainWindow.setMinimizable === 'function') mainWindow.setMinimizable(false);
    if (typeof mainWindow.setResizable === 'function') mainWindow.setResizable(false);
    setImmediate(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const display = screen.getDisplayMatching(mainWindow.getBounds());
        mainWindow.setBounds(display.bounds, false);
      }
    });
  } else {
    mainWindow.setKiosk(false);
    mainWindow.setFullScreen(false);
    mainWindow.setAlwaysOnTop(false);
    // Keep the native Windows title bar, but never expose Electron's website-style menu.
    mainWindow.setMenuBarVisibility(false);
    if (typeof mainWindow.setClosable === 'function') mainWindow.setClosable(true);
    if (typeof mainWindow.setMinimizable === 'function') mainWindow.setMinimizable(true);
    if (typeof mainWindow.setResizable === 'function') mainWindow.setResizable(true);
    mainWindow.setSize(1280, 850);
    mainWindow.center();
  }
}

function showWelcome(message = '') {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  examMode = false;
  currentExamUrl = null;
  applyWindowMode('file://welcome');
  mainWindow.loadFile(path.join(__dirname, 'splash.html')).then(() => {
    if (message) mainWindow.webContents.send('cnseb:welcome-message', message);
  }).catch(error => console.error('[CN-SEB] Could not return to welcome screen:', error));
}

function loadExam(url) {
  const target = isValidExamUrl(url) ? url : null;
  if (!target) { showWelcome('Open your exam from the student portal or enter an activation key.'); return; }
  if (isValidExamUrl(target)) currentExamUrl = target;
  if (mainWindow && !mainWindow.isDestroyed()) {
    applyWindowMode(target);
    mainWindow.loadURL(target);
  } else pendingExamUrl = target;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    show: false,
    // Login and administration use a normal desktop window. Strict kiosk
    // is enabled only after an examination URL is opened.
    autoHideMenuBar: true, kiosk: false, fullscreen: false, fullscreenable: true, frame: true,
    resizable: true, maximizable: true, minimizable: true, closable: true,
    skipTaskbar: false, alwaysOnTop: false,
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
    else if (isTrusted(url)) setImmediate(() => loadExam(url));
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const examTarget = extractExamUrl([url]);
    if (examTarget) { event.preventDefault(); loadExam(examTarget); return; }
    if (!isTrusted(url)) event.preventDefault();
    else applyWindowMode(url);
  });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.webContents.on('before-input-event', (event, input) => {
    // Keep the normal login/admin window usable. Apply exam restrictions only
    // after a verified exam URL has activated native kiosk mode.
    if (!examMode || input.type !== 'keyDown') return;
    const key = String(input.key || '').toLowerCase();
    const ctrlOrMeta = !!(input.control || input.meta);
    const blockedCtrlKeys = [
      'r','w','t','n','l','p','s','c','v','x','u','o','j','d',
      'f','g','h','q','e','+','=','-','0','insert','delete'
    ];
    const blocked =
      (ctrlOrMeta && blockedCtrlKeys.includes(key)) ||
      (ctrlOrMeta && input.shift && ['i','j','c','k','n','escape'].includes(key)) ||
      (input.alt && ['left','right','f4','f','tab','space','escape'].includes(key)) ||
      (input.control && input.alt) ||
      ['f1','f3','f5','f6','f10','f11','f12','printscreen'].includes(key) ||
      ['meta','super','os'].includes(key);
    if (blocked) {
      event.preventDefault();
      if (['f12','printscreen'].includes(key)) {
        mainWindow.webContents.send('cnseb:device-event', {
          eventType: key === 'printscreen' ? 'screenshot_shortcut_blocked' : 'developer_shortcut_blocked',
          details: { key: input.key, modifiers: { control: !!input.control, alt: !!input.alt, shift: !!input.shift, meta: !!input.meta } },
          timestamp: new Date().toISOString()
        });
      }
    }
  });
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[CN-SEB] Renderer process ended:', details.reason);
    if (!quitting && mainWindow && !mainWindow.isDestroyed()) {
      // Recover the same in-progress exam after a renderer crash; never send a
      // student back to the generic login page and silently drop the attempt.
      if (currentExamUrl || pendingExamUrl) loadExam(currentExamUrl || pendingExamUrl);
      else showWelcome();
    }
  });
  const enforceKioskDisplay = () => {
    if (!mainWindow || mainWindow.isDestroyed() || !STRICT || !examMode) return;
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
    if (STRICT && examMode && !quitting) setImmediate(enforceKioskDisplay);
  });
  mainWindow.on('minimize', event => {
    if (STRICT && examMode && !quitting) {
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
    const target = pendingExamUrl || initialTarget;
    pendingExamUrl = null;
    if (target) loadExam(target);
  };
  mainWindow.webContents.once('did-finish-load', resolveStartupDestination);
  mainWindow.loadFile(path.join(__dirname, 'splash.html')).catch(error => {
    console.error('[CN-SEB] Startup screen failed:', error);
    resolveStartupDestination();
  });
}

if (!app.requestSingleInstanceLock()) app.quit();
else {
  const initialLaunch = extractLaunch(process.argv);
  pendingExamUrl = initialLaunch?.url || null;
  pendingHandoffCode = initialLaunch?.code || null;
  app.on('second-instance', (_event, commandLine) => {
    const launch = extractLaunch(commandLine);
    const target = launch?.url || null;
    if (target) { pendingExamUrl = target; pendingHandoffCode = launch.code || null; }
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (target) loadExam(target);
    }
  });
  app.on('open-url', (event, url) => {
    event.preventDefault();
    const launch = extractLaunch([url]);
    const target = launch?.url || null;
    if (target) {
      pendingExamUrl = target;
      pendingHandoffCode = launch.code || null;
      if (mainWindow) loadExam(target);
    }
  });
}

app.whenReady().then(() => {
  loadDeviceIdentity();
  // This is a dedicated examination client, not a browser shell. Remove the
  // default File/Edit/View/Window/Help menu while retaining native window controls.
  Menu.setApplicationMenu(null);
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
  ipcMain.handle('cnseb:brand-logo-url', () => 'https://campusnexus.co.ke/images/campus-nexus-original-logo.webp');
  ipcMain.handle('cnseb:update-state', () => updateState);
  ipcMain.handle('cnseb:encrypted-draft-save', (event, payload) => writeEncryptedDraft(event, payload));
  ipcMain.handle('cnseb:encrypted-draft-load', (event, payload) => readEncryptedDraft(event, payload));
  ipcMain.handle('cnseb:encrypted-draft-clear', (event, payload) => clearEncryptedDraft(event, payload));
  ipcMain.handle('cnseb:show-welcome-message', (_event, message) => {
    if (mainWindow && !mainWindow.isDestroyed() && !examMode) mainWindow.webContents.send('cnseb:welcome-message', String(message || '').slice(0, 300));
    return { ok: true };
  });
  ipcMain.handle('cnseb:activate-with-key', async (_event, suppliedCode) => {
    const code = String(suppliedCode || '').trim().toUpperCase();
    if (!/^[A-HJ-NP-Z2-9]{12}$/.test(code)) return { ok: false, error: 'Enter the 12-character activation key supplied for your examination.' };
    if (!deviceInstallId) return { ok: false, error: 'Secure device identity is unavailable. Restart the application and try again.' };
    try {
      const response = await fetch(HANDOFF_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({ action: 'redeem', code, device_install_id: deviceInstallId,
          device_name: os.hostname(), platform: process.platform, app_version: app.getVersion(),
          device_details: { platform: process.platform, architecture: process.arch } }),
        signal: AbortSignal.timeout(12000)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.token_hash || !payload.exam_id || !payload.device_registration_id) {
        const reason = payload.error || '';
        const message = /expired|already used/i.test(reason)
          ? 'This key has already been used or expired. Do not reuse it. Return to the student examination centre, click Enter Online Exam again to generate a fresh key, then launch the app.'
          : (reason || 'This activation key could not be verified. Return to the student examination centre and request a new key.');
        return { ok: false, error: message };
      }
      saveDeviceRegistration({ id: payload.device_registration_id, status: payload.device_approval_status || 'pending', institutionId: payload.institution_id || null });
      if (payload.device_approval_status !== 'approved') {
        return { ok: false, pendingApproval: true, error: 'This computer has been registered and is awaiting institution administrator approval. Please try again after approval.' };
      }
      pendingRedeemedHandoff = { ok: true, token_hash: payload.token_hash, type: 'magiclink', exam_id: String(payload.exam_id) };
      const target = new URL('/exam.html', EXAM_ORIGIN);
      target.searchParams.set('exam_id', String(payload.exam_id));
      target.searchParams.set('client', 'cnseb');
      loadExam(target.href);
      return { ok: true };
    } catch (error) {
      console.error('[CN-SEB] Activation failed:', error.message);
      return { ok: false, error: 'Could not verify the activation key. Check the internet connection and try again.' };
    }
  });
  ipcMain.handle('cnseb:return-to-welcome', (event) => {
    const frameUrl = event.senderFrame?.url || '';
    if (!isValidExamUrl(frameUrl)) return { ok: false };
    pendingRedeemedHandoff = null;
    pendingHandoffCode = null;
    showWelcome('Your secure session could not be verified. Launch the exam again from the student portal or enter a new activation key.');
    return { ok: true };
  });
  ipcMain.handle('cnseb:redeem-auth-handoff', async (event) => {
    const frameUrl = event.senderFrame?.url || '';
    if (!isValidExamUrl(frameUrl)) return { ok: false, error: 'Authentication handoff is only available on the verified exam page.' };
    const current = new URL(frameUrl);
    if (pendingRedeemedHandoff) {
      const ready = pendingRedeemedHandoff;
      if (current.searchParams.get('exam_id') !== String(ready.exam_id)) return { ok: false, error: 'The activation key does not belong to this examination.' };
      pendingRedeemedHandoff = null;
      return ready;
    }
    const code = pendingHandoffCode;
    if (!code) return { ok: false, unavailable: true };
    pendingHandoffCode = null;
    try {
      const response = await fetch(HANDOFF_ENDPOINT, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
        body: JSON.stringify({
          action: 'redeem', code, device_install_id: deviceInstallId,
          device_name: os.hostname(), platform: process.platform,
          app_version: app.getVersion(),
          device_details: { platform: process.platform, architecture: process.arch }
        }), signal: AbortSignal.timeout(12000)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.token_hash || !payload.exam_id || !payload.device_registration_id) return { ok: false, error: payload.error || 'Secure sign-in could not be completed. Return to the student portal and launch again.' };
      saveDeviceRegistration({ id: payload.device_registration_id, status: payload.device_approval_status || 'pending', institutionId: payload.institution_id || null });
      if (payload.device_approval_status !== 'approved') {
        showWelcome('This computer has been registered and is awaiting institution administrator approval. Please try launching your examination again after approval.');
        return { ok: false, error: 'This computer is awaiting institution administrator approval.' };
      }
      const current = new URL(frameUrl);
      if (current.searchParams.get('exam_id') !== String(payload.exam_id)) return { ok: false, error: 'This sign-in code does not belong to the selected examination.' };
      return { ok: true, token_hash: payload.token_hash, type: 'magiclink', exam_id: String(payload.exam_id) };
    } catch (error) {
      console.error('[CN-SEB] Authentication handoff failed:', error.message);
      return { ok: false, error: 'Unable to connect to secure sign-in. Check the internet connection and relaunch the examination.' };
    }
  });
  ipcMain.on('cnseb:is-kiosk', event => {
    event.returnValue = !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isKiosk() && mainWindow.isFullScreen());
  });
  ipcMain.handle('cnseb:device-info', () => ({
    appVersion: app.getVersion(), platform: process.platform,
    architecture: process.arch, strictMode: STRICT,
    deviceInstallId, deviceRegistrationId: deviceRegistration?.id || null,
    deviceApprovalStatus: deviceRegistration?.status || 'not_registered',
    kioskRuntime: !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isKiosk() && mainWindow.isFullScreen()),
    deviceTrust: 'unverified', managedWindowsPolicyRequired: true,
    displayCount: screen.getAllDisplays().length
  }));
  // Use an in-app confirmation rather than a native modal hidden behind kiosk.
  ipcMain.handle('cnseb:exam-submission-complete', async (event, exitAction = 'exit-exam') => {
    const frameUrl = event.senderFrame?.url || '';
    if (!isValidExamUrl(frameUrl) || !examMode || quitting) return { ok: false };
    if (!['exit-exam', 'exit-app'].includes(exitAction)) return { ok: false, reason: 'invalid-exit-action' };

    // This IPC is accepted only after exam.js has completed its normal
    // submission pipeline: answers and grade saved, attempt submitted and
    // server-side device/session lock released.
    exitInProgress = true;
    if (exitAction === 'exit-app') {
      quitting = true;
      setTimeout(() => app.exit(0), 350);
      return { ok: true, action: 'exit-app' };
    }

    // "Exit examination" ends the attempt but leaves CN-SEB available for
    // the next authorised exam. It does not sign the student out.
    quitting = false;
    exitInProgress = false;
    showWelcome('Your examination has been submitted successfully. You may close the app or wait for your next examination.');
    return { ok: true, action: 'exit-exam' };
  });
  ipcMain.handle('cnseb:request-exit', async () => {
    if (examMode) return { ok: false, reason: 'exam-active', message: 'Submit or complete the examination before exiting the secure browser.' };
    if (quitting) return { ok: true };
    exitInProgress = true;
    quitting = true;
    setTimeout(() => app.exit(0), 150);
    return { ok: true };
  });
  ipcMain.handle('cnseb:request-logout', async () => {
    if (examMode) return { ok: false, reason: 'exam-active', message: 'Submit or complete the examination before logging out.' };
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
    if (examMode) return { ok: false, reason: 'exam-active', message: 'Updates cannot be installed during an active examination. The update will remain ready until the examination is complete.' };
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
      updateState = { ...updateState, ...payload, installedVersion: app.getVersion() };
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('cnseb:update-status', updateState);
      }
    };
    autoUpdater.on('checking-for-update', () => publishUpdateState({ state: 'checking' }));
    autoUpdater.on('update-available', info => {
      console.log('[CN-SEB] Update available:', info.version);
      publishUpdateState({ state: 'downloading', version: info.version, latestVersion: info.version, lastCheckedAt: new Date().toISOString() });
    });
    autoUpdater.on('update-not-available', info => {
      console.log('[CN-SEB] App is up to date:', info.version);
      publishUpdateState({ state: 'current', version: info.version, latestVersion: info.version, lastCheckedAt: new Date().toISOString() });
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
