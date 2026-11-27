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
