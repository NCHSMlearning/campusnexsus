const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('release version is 1.3.x', () => {
  const pkg = JSON.parse(read('secure-exam-browser/package.json'));
  assert.match(pkg.version, /^1\.3\.\d+$/);
});

test('active exam exposes separate submit-exam and close-app actions', () => {
  const preload = read('secure-exam-browser/src/preload.js');
  const main = read('secure-exam-browser/src/main.js');
  assert.match(preload, /Exit examination/);
  assert.match(preload, /Exit app/);
  assert.match(preload, /submit-exam/);
  assert.match(preload, /submit-close-app/);
  assert.match(main, /exit-exam/);
  assert.match(main, /exit-app/);
  assert.match(main, /cnseb:exam-submission-complete/);
});

test('exit action is bridged to the secure submission pipeline', () => {
  const preload = read('secure-exam-browser/src/preload.js');
  const exam = read('exam.js');
  assert.match(preload, /cnseb:request-submit-exam/);
  assert.match(exam, /cnseb:request-submit-exam/);
  assert.match(exam, /cnseb:exam-submission-complete/);
  assert.match(exam, /cnseb:exam-submission-failed/);
  assert.match(exam, /cnseb_submit_exam_attempt_secure/);
});

test('answer drafts remain local and retry after connectivity returns', () => {
  const exam = read('exam.js');
  assert.match(exam, /saveToLocalStorage/);
  assert.match(exam, /scheduleAnswerDraftSyncRetry/);
  assert.match(exam, /window\.addEventListener\('online'/);
  assert.match(exam, /get_exam_attempt_answer_drafts/);
});

test('secure attempt is prepared before device session is claimed', () => {
  const exam = read('exam.js');
  const start = exam.indexOf('window.startExam = async function');
  assert.notEqual(start, -1);
  const body = exam.slice(start, start + 14000);
  assert.ok(body.indexOf('getOrCreateCurrentAttempt()') < body.indexOf('claimExamSessionLock()'));
});


test('secure exam heartbeat remains active until final submission and session release', () => {
  const exam = read('exam.js');
  const submit = exam.indexOf('async function executeSubmissionWithLoading');
  const body = exam.slice(submit, submit + 12000);
  const heartbeatStop = body.indexOf('clearInterval(AppState.heartbeatInterval)');
  const serverSubmit = body.indexOf('await calculateAndSaveGrade()');
  const release = body.indexOf('await releaseExamSessionLock()');
  assert.ok(serverSubmit > 0, 'server submission call must exist');
  assert.ok(release > serverSubmit, 'session release must follow successful server submission');
  assert.ok(heartbeatStop > release, 'heartbeat must not stop before the server submission and release');
});

test('CN-SEB submission only reports completion after server-side submission returns', () => {
  const exam = read('exam.js');
  const body = exam.slice(exam.indexOf('async function executeSubmissionWithLoading'), exam.indexOf('function showSubmissionProgress'));
  assert.ok(body.indexOf('await calculateAndSaveGrade()') < body.indexOf('cnseb:exam-submission-complete'));
  assert.ok(body.indexOf('await saveAllAnswersToDatabase()') < body.indexOf('await calculateAndSaveGrade()'));
});

test('exam attempt configuration snapshots are immutable and exclude marking secrets', () => {
  const migration = read('platform/database/migrations/20261126203000_cnseb_immutable_exam_attempt_snapshots.sql');
  assert.match(migration, /after insert on public\.exam_attempts/i);
  assert.match(migration, /snapshot_sha256/);
  assert.match(migration, /extensions\.digest\(v_payload::text, 'sha256'\)/);
  assert.match(migration, /before update or delete on public\.exam_attempt_configuration_snapshots/i);
  assert.match(migration, /question_text/);
  assert.match(migration, /option_a/);
  assert.doesNotMatch(migration, /'correct_answer'|'marking_key'|'marking_rubric'/i);
  assert.match(migration, /revoke all on public\.exam_attempt_configuration_snapshots from public, anon, authenticated/i);
});
