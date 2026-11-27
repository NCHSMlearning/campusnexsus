const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));
const welcome = fs.readFileSync(path.join(root, 'www', 'index.html'), 'utf8');

test('Campus Nexus app has a distinct Android identity', () => {
  assert.equal(config.appId, 'co.ke.campusnexus.app');
  assert.equal(config.appName, 'Campus Nexus');
  assert.equal(pkg.name, 'campus-nexus-app');
});

test('portal app bundles its institution gate and routes to the production portals', () => {
  assert.equal(config.server.url, undefined, 'the app should use its bundled welcome screen');
  assert.match(welcome, /resolve_institution_registration_context/);
  assert.match(welcome, /https:\/\/campusnexus\.co\.ke\/platform\/login\.html\?school_code=.*source=android-app/);
  assert.match(welcome, /https:\/\/campusnexus\.co\.ke\/examlogin\.html\?school_code=.*source=android-app/);
  assert.equal(welcome.includes('secure-exam-browser'), false);
});

test('only the required trusted origins are allowed for app navigation', () => {
  assert.deepEqual(config.server.allowNavigation, [
    'campusnexus.co.ke',
    'www.campusnexus.co.ke',
    'cdn.jsdelivr.net',
    'irahplkvocaakjxuisto.supabase.co'
  ]);
});

test('Android app mode survives the remote portal handoff and enables role-specific navigation', () => {
  const shell = fs.readFileSync(path.join(root, '..', 'campus-nexus-app-shell.js'), 'utf8');
  assert.match(welcome, /source=android-app/);
  assert.match(shell, /cn_android_app_mode/);
  assert.match(shell, /cn-native-institution-app/);
  assert.match(shell, /cn-native-lecturer-app/);
  assert.match(shell, /cn-native-tabbar/);
});

test('Android app mode persists across login redirects and student dashboard loads the shell directly', () => {
  const shell = fs.readFileSync(path.join(root, '..', 'campus-nexus-app-shell.js'), 'utf8');
  const studentPage = fs.readFileSync(path.join(root, '..', 'platform', 'student.html'), 'utf8');
  const loginPage = fs.readFileSync(path.join(root, '..', 'platform', 'login.html'), 'utf8');
  assert.ok(shell.includes('cn_android_app_mode=1; Max-Age=31536000; Path=/; SameSite=Lax; Secure'));
  assert.ok(shell.includes('cn_android_app_mode=1'));
  assert.ok(studentPage.includes('campus-nexus-app-shell.js?v=1.3.1'));
  assert.ok(loginPage.includes('campus-nexus-app-shell.js?v=1.3.0'));
});

test('mobile pull-to-refresh only arms when the primary page scroller is at the top', () => {
  const shell = fs.readFileSync(path.join(root, '..', 'campus-nexus-app-shell.js'), 'utf8');
  const mobile = fs.readFileSync(path.join(root, '..', 'js', 'nchsm-mobile-enhancements.js'), 'utf8');
  assert.match(shell, /function pageAtTop\(target\)/);
  assert.match(shell, /target\.nodeType === 1 \? target : target\.parentElement/);
  assert.match(shell, /node !== primaryScroller \|\| node\.scrollTop > 1/);
  assert.match(mobile, /const canPullRefresh = \(target\)/);
  assert.match(mobile, /target\.nodeType === 1 \? target : target\.parentElement/);
  assert.match(mobile, /node !== primaryScroller \|\| node\.scrollTop > 2/);
  assert.match(mobile, /getComputedStyle\(node\)/);
});
