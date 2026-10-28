// file-lock.test.mjs — "failed to remove file … Access is denied (os error 5)" is retried after a back-off and
// the log names the process that held the file (KIT-T675).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileLockFailure, holdersOf } from './file-lock.mjs';
import { runCancellable } from './run-cancellable.mjs';

const DENIED = 'error: failed to remove file `C:\w\target\debug\dirt-empire.exe`\n\nCaused by:\n  Access is denied. (os error 5)\n';

test('detects the denied removal and names the path; other failures are not file locks', () => {
  assert.equal(fileLockFailure(DENIED), 'C:\w\target\debug\dirt-empire.exe');
  assert.equal(fileLockFailure('error: failed to remove file `x`\n\nCaused by:\n  No such file (os error 2)'), null);
  assert.equal(fileLockFailure('error[E0308]: mismatched types'), null);
});

test('holdersOf parses the process query output and survives a failing query', () => {
  const rows = holdersOf('x.exe', { run: () => '412|dirt-empire.exe|C:\w\dirt-empire.exe --test\n' });
  assert.deepEqual(rows, [{ pid: 412, name: 'dirt-empire.exe', cmd: 'C:\w\dirt-empire.exe --test' }]);
  assert.deepEqual(holdersOf('x.exe', { run: () => { throw new Error('no powershell'); } }), []);
});

function flaky(deniedRuns) {
  const root = mkdtempSync(join(tmpdir(), 'filelock-'));
  const counter = join(root, 'count');
  const script = join(root, 'run.cjs');
  writeFileSync(script, `const fs=require('fs');const n=fs.existsSync(${JSON.stringify(counter)})?Number(fs.readFileSync(${JSON.stringify(counter)},'utf8')):0;fs.writeFileSync(${JSON.stringify(counter)},String(n+1));if(n<${deniedRuns}){console.log(${JSON.stringify(DENIED)});process.exit(101)}`);
  return { root, script, logPath: join(root, 'out.log'), counter };
}
const opts = (f, extra = {}) => ({ cwd: f.root, targetDir: f.root, logPath: f.logPath, jobs: 1, lockBackoffMs: [10, 10, 10], findHolders: () => '777|stray.exe|stray.exe --hang', ...extra });
const hooks = { shouldCancel: () => false, pollMs: 20 };

test('a denied removal is retried after the back-off and the log names the holder', () => {
  const f = flaky(2);
  const r = runCancellable(`node ${f.script}`, opts(f), hooks);
  assert.equal(r.exit, 0);
  assert.equal(readFileSync(f.counter, 'utf8'), '3', 'ran three times');
  assert.match(r.recovered, /held by stray\.exe \(pid 777\).*retry 1 of 3/);
  assert.match(readFileSync(f.logPath, 'utf8'), /\[broker\] file lock on .*stray\.exe \(pid 777\).*retry exit 0/s);
});

test('negative control: a lock that never clears fails after the retries are used', () => {
  const f = flaky(99);
  const r = runCancellable(`node ${f.script}`, opts(f), hooks);
  assert.equal(r.exit, 101);
  assert.equal(readFileSync(f.counter, 'utf8'), '4', 'first run plus three retries');
  assert.ok(existsSync(f.logPath));
});

test('a plain failure is not retried', () => {
  const root = mkdtempSync(join(tmpdir(), 'filelock-'));
  const r = runCancellable('node -e "process.exit(3)"', { cwd: root, targetDir: root, logPath: join(root, 'o.log'), jobs: 1 }, hooks);
  assert.equal(r.exit, 3);
  assert.equal(r.recovered, undefined);
});
