// link-recover.test.mjs — a stale-incremental link failure clears that crate's incremental units and retries once.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { linkFailure } from './link-recover.mjs';
import { runCancellable } from './run-cancellable.mjs';

const LOG = 'error: linking with `rust-lld.exe` failed: exit code: 1\n  = note: rust-lld: error: undefined symbol: anon.2c8028dcd674d3391505e3ac3e7b112a.6.llvm.11184885677625199351\nerror: could not compile `dirt-empire` (test "x") due to 1 previous error\n';

test('detects the link failure and names the crate; ordinary failures are not link failures', () => {
  assert.deepEqual(linkFailure(LOG), { crate: 'dirt-empire' });
  assert.equal(linkFailure('error[E0308]: mismatched types\nerror: could not compile `dirt-empire`'), null);
  assert.equal(linkFailure('error: linking with `cc` failed\nundefined reference to `foo`'), null);
});

test('a link-failing command clears only that crate\'s incremental units, retries once, logs it', () => {
  const root = mkdtempSync(join(tmpdir(), 'linkrec-'));
  const inc = join(root, 'target', 'debug', 'incremental');
  for (const d of ['dirt_empire-aaa', 'other-bbb']) { mkdirSync(join(inc, d), { recursive: true }); writeFileSync(join(inc, d, 'f'), 'x'); }
  const script = join(root, 'run.cjs');
  const counter = join(root, 'count');
  writeFileSync(script, `const fs=require('fs');const n=fs.existsSync(${JSON.stringify(counter)})?1:0;fs.writeFileSync(${JSON.stringify(counter)},'1');if(n===0){console.log(${JSON.stringify(LOG)});process.exit(1)}`);
  const logPath = join(root, 'out.log');
  const r = runCancellable(`node ${script}`, { cwd: root, targetDir: join(root, 'target'), logPath, jobs: 1 }, { shouldCancel: () => false, pollMs: 20 });
  assert.equal(r.exit, 0);
  assert.match(r.recovered, /cleared 1 incremental unit\(s\) of dirt-empire/);
  assert.ok(!existsSync(join(inc, 'dirt_empire-aaa')));
  assert.ok(existsSync(join(inc, 'other-bbb')), 'negative control: other crates untouched');
  assert.match(readFileSync(logPath, 'utf8'), /\[broker\] link failure.*retry exit 0/);
});

test('a plain failure is not retried', () => {
  const root = mkdtempSync(join(tmpdir(), 'linkrec-'));
  const r = runCancellable('node -e "process.exit(3)"', { cwd: root, targetDir: root, logPath: join(root, 'o.log'), jobs: 1 }, { shouldCancel: () => false, pollMs: 20 });
  assert.equal(r.exit, 3);
  assert.equal(r.recovered, undefined);
});
