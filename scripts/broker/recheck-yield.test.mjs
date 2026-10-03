// recheck-yield.test.mjs — the idle re-check of deferred failures never delays real work (KIT-T310):
// no re-check starts while a job is queued, and a running one is killed, its locks restored, the
// moment a job arrives.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { addDeferred, listDeferred, recheckDeferred } from './deferred.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, fixture } from './patchkit.mjs';
import { tempDir } from './testkit.mjs';

const PASS = 'node -e "process.exit(0)"';
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const until = (fn, ms = 10_000) => { const end = Date.now() + ms; while (!fn() && Date.now() < end) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100); return fn(); };

// A deferred entry whose re-check command is `body`; HEAD differs from the recorded one so it triggers.
function withDeferred(body) {
  const s = fixture();
  commitOnMain(s.root, 'Cargo.lock', 'base\n', 'lock');
  const code = body.replace(/"/g, '\\"');
  addDeferred(s.cfg, [{ repo: 'app', test: 't_slow', cmd: `node -e "${code}"`, job: 'j-old', reason: 'r', dirty: [], head: '0'.repeat(40) }]);
  return s;
}

test('a queued job means no re-check starts', () => {
  const s = withDeferred("require('fs').writeFileSync('ran.txt','x')");
  try {
    writeJob(s.cfg, { ...buildPatchJob(s.cfg, {}, '*** write p.txt\np\n').job, commands: [PASS] });
    const out = recheckDeferred(s.cfg);
    assert.deepEqual(out, { dropped: [], filed: [], kept: [] });
    assert.equal(existsSync(join(s.root, 'ran.txt')), false, 're-check command never ran');
    assert.equal(listDeferred(s.cfg).length, 1);
  } finally { s.done(); }
});

test('negative: with an empty queue the re-check runs to completion', () => {
  const s = withDeferred("require('fs').writeFileSync('ran.txt','x')");
  try {
    const sum = processOnce(s.cfg);
    assert.equal(sum.deferred.cancelled, undefined);
    assert.equal(readFileSync(join(s.root, 'ran.txt'), 'utf8'), 'x');
    assert.deepEqual(sum.deferred.kept.concat(sum.deferred.dropped, sum.deferred.filed).length, 1, 'the entry was judged');
  } finally { s.done(); }
});

test('a job arriving mid re-check kills the re-check, restores its locks and runs the job', () => {
  const side = tempDir('yield-');
  const pidFile = join(side, 'pid.txt');
  const s = withDeferred('x');
  try {
    const job = { ...buildPatchJob(s.cfg, {}, '*** write p.txt\np\n').job, commands: [PASS] };
    const pending = join(side, 'job.json');
    writeFileSync(pending, JSON.stringify({ ...job, submittedAt: new Date().toISOString() }));
    const queued = join(s.cfg.targetDir, 'broker', 'queue', `${job.id}.json`);
    // First run: rewrite the lock, drop the job into the queue, then hang. Later runs (after the kill) exit at once.
    const body = [
      "const fs=require('fs')",
      `if(fs.existsSync(${JSON.stringify(pidFile)}))process.exit(0)`,
      "fs.writeFileSync('Cargo.lock','rewritten by the re-check')",
      `fs.writeFileSync(${JSON.stringify(pidFile)},String(process.pid))`,
      `fs.copyFileSync(${JSON.stringify(pending)},${JSON.stringify(queued)})`,
      'setTimeout(()=>{},120000)',
    ].join(';');
    addDeferred(s.cfg, [{ repo: 'app', test: 't_slow', cmd: `node -e "${body.replace(/"/g, '\\"')}"`, job: 'j-old', reason: 'r', dirty: [], head: '0'.repeat(40) }]);
    const started = Date.now();
    const sum = processOnce(s.cfg);
    assert.ok(Date.now() - started < 60_000, 'returned without waiting out the 120 s command');
    assert.equal(readResult(s.cfg, job.id).status, 'passed', 'the arriving job ran');
    assert.equal(readFileSync(join(s.root, 'Cargo.lock'), 'utf8'), 'base\n', 'locks restored');
    assert.ok(until(() => !alive(Number(readFileSync(pidFile, 'utf8')))), 'the re-check process tree is dead');
    assert.ok(listDeferred(s.cfg).some((e) => e.cmd.includes('120000')), 'the entry waits for the next idle moment');
    assert.deepEqual(sum.processed.map((r) => r.id), [job.id]);
  } finally { s.done(); }
});
