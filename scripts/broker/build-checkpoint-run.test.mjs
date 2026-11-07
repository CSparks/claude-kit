// build-checkpoint-run.test.mjs — runCancellable with a checkpoint (KIT-D137): a build that keeps producing output runs past
// its budget, a stalled one is stopped at the check, and the check line reaches the log and the heartbeat a waiter reads.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { runCancellable } from './run-cancellable.mjs';
import { heartbeatLine } from './heartbeat.mjs';
import { readNote, writeNote } from './build-note.mjs';
import { brokerPaths } from './config.mjs';
import { capture } from './preimage.mjs';
import { ensureDirs, writeJob } from './result.mjs';
import { fixture } from './patchkit.mjs';
import { tempDir } from './testkit.mjs';

const BUDGET_MS = 4000;
const INTERVAL_MS = 3000;
const POLL_MS = 50;
const STALL_DEADLINE_MS = 30000;
const hooks = { shouldCancel: () => false, pollMs: POLL_MS };
const opts = (dir, extra) => ({ cwd: dir, targetDir: dir, logPath: join(dir, 'o.log'), jobs: 1, timeoutMs: BUDGET_MS, ...extra });
const PROGRESSING = `node -e "let n=0;const t=setInterval(()=>{console.log('   Compiling crate'+(n++)+' v0.1.0');if(n>=45){clearInterval(t)}},200)"`;
const STALLED = 'node -e "setTimeout(()=>{},120000)"';

test('a build that keeps producing output runs past its budget and says what it is building at the check', () => {
  const dir = tempDir('checkpoint-progress-');
  const r = runCancellable(PROGRESSING, opts(dir, { checkpoint: { intervalMs: INTERVAL_MS } }), hooks);
  assert.equal(r.exit, 0);
  assert.equal(r.timedOut, undefined);
  assert.ok(r.durationMs > BUDGET_MS, `ran ${r.durationMs} ms, past the ${BUDGET_MS} ms budget`);
  const log = readFileSync(join(dir, 'o.log'), 'utf8');
  assert.match(log, /\[broker\] 3 s check: compiling crate\d+/);
  assert.match(log, /progressing \(log \+\d+ B, CPU \+/);
  assert.match(log, /Compiling crate44 v0.1.0/, 'the child kept its own output beside the broker lines');
});

test('control: the same command without a checkpoint is killed at the flat limit', () => {
  const dir = tempDir('checkpoint-flat-');
  const r = runCancellable(PROGRESSING, opts(dir, {}), hooks);
  assert.equal(r.timedOut, true);
  assert.equal(r.stalled, undefined);
});

test('a stalled build is stopped at the check with the reason, never left to run', () => {
  const dir = tempDir('checkpoint-stalled-');
  const r = runCancellable(STALLED, opts(dir, { checkpoint: { intervalMs: INTERVAL_MS } }), hooks);
  assert.equal(r.timedOut, true);
  assert.match(r.stalled, /no log output and no CPU in the build tree/);
  assert.ok(r.durationMs < STALL_DEADLINE_MS, `stopped after ${r.durationMs} ms`);
  assert.match(readFileSync(join(dir, 'o.log'), 'utf8'), /STALLED, stopping the build/);
});

const spinner = (ms) => `node -e "const end=Date.now()+${ms};while(Date.now()<end){}"`;

test('a silent command using CPU inside its budget is progressing: the check sees the CPU of its process tree', () => {
  const dir = tempDir('checkpoint-cpu-');
  const r = runCancellable(spinner(7000), opts(dir, { timeoutMs: 20000, checkpoint: { intervalMs: INTERVAL_MS } }), hooks);
  assert.equal(r.exit, 0);
  assert.equal(r.timedOut, undefined);
  assert.match(readFileSync(join(dir, 'o.log'), 'utf8'), /progressing \(log \+0 B, CPU \+[1-9]\d* s\)/);
});

test('a silent CPU spinner past its budget with no compiler is a hung test and is stopped (KIT-T676)', () => {
  const dir = tempDir('checkpoint-spin-');
  const r = runCancellable(spinner(60000), opts(dir, { timeoutMs: 2000, checkpoint: { intervalMs: INTERVAL_MS } }), hooks);
  assert.equal(r.timedOut, true);
  assert.match(r.stalled, /a hung test/);
});

test('the waiter heartbeat repeats the latest check line of the running command', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    writeJob(s.cfg, { id: 'j-1-a', repo: 'app', ops: [] });
    const journal = capture(s.cfg, { id: 'j-1-a', cwd: s.root, paths: [] });
    const log = join(brokerPaths(s.cfg).logs, 'j-1-a-0.log');
    writeFileSync(log, '');
    const at = Date.parse(journal.startedAt) + 301_000;
    assert.equal(heartbeatLine(s.cfg, 'j-1-a', at), 'wait: j-1-a running 301s, on command 1');
    writeNote(log, '5 min check: compiling rg-water (62 crates compiled so far); progressing');
    assert.equal(readNote(log), '5 min check: compiling rg-water (62 crates compiled so far); progressing');
    assert.equal(heartbeatLine(s.cfg, 'j-1-a', at), 'wait: j-1-a running 301s, on command 1; 5 min check: compiling rg-water (62 crates compiled so far); progressing');
  } finally { s.done(); }
});
