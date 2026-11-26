const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const config = JSON.parse(fs.readFileSync(path.join(root, 'capacitor.config.json'), 'utf8'));

test('Campus Nexus app has a distinct Android identity', () => {
  assert.equal(config.appId, 'co.ke.campusnexus.app');
  assert.equal(config.appName, 'Campus Nexus');
  assert.equal(pkg.name, 'campus-nexus-app');
});

test('portal app loads the production portal over HTTPS, not the exam browser', () => {
  assert.equal(config.server.url, 'https://campusnexus.co.ke/platform/login.html?source=android-app');
  assert.equal(config.server.cleartext, false);
  assert.equal(config.server.url.includes('secure-exam-browser'), false);
});

test('only Campus Nexus web origins are allowed as in-app navigation', () => {
  assert.deepEqual(config.server.allowNavigation, ['campusnexus.co.ke', 'www.campusnexus.co.ke']);
});
