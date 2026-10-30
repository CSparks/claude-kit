// precheck.mjs + run-cancellable.mjs: a check that never ran leaves no log, and that must not crash submit (KIT-T716).
// A cancel while the command waits for its build slot returns before the log is opened; the precheck then read it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { hostname, tmpdir } from 'node:os';
import { join } from 'node:path';
import { precheckJob } from './precheck.mjs';
import { runCancellable } from './run-cancellable.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture } from './patchkit.mjs';

const CANCELLED = { cmd: 'cargo check', exit: 1, durationMs: 0, logTail: [], cancelled: true };
const RUSTC_LOG = 'error[E0308]: mismatched types\n --> crates/x/src/lib.rs:3:5\n';

function setup() {
  const s = fixture();
  const cfg = { ...s.cfg, precheck: true, precheckTimeoutMs: 30000, affected: { ...s.cfg.affected, check: 'cargo check --workspace --all-targets' } };
  const { job } = buildPatchJob(cfg, { ticket: 'KIT-T1' }, envelope(['beta', 'BETA']));
  return { s, cfg, job, repo: cfg.repos[0] };
}

test('a stage cancelled before it started leaves no log: the precheck lets the job queue instead of throwing ENOENT', () => {
  const { s, cfg, job, repo } = setup();
  try {
    assert.equal(precheckJob(cfg, job, repo, { run: () => CANCELLED, busy: () => false }), null);
  } finally { s.done(); }
});

test('a precheck that crashes for any reason reports it on stderr and lets the job queue', () => {
  const { s, cfg, job, repo } = setup();
  const errors = [];
  const original = console.error;
  console.error = (line) => errors.push(String(line));
  try {
    assert.equal(precheckJob(cfg, job, repo, { run: () => { throw new Error('spawn exploded'); }, busy: () => false }), null);
  } finally { console.error = original; s.done(); }
  assert.ok(errors.some((e) => /precheck skipped \(spawn exploded\)/.test(e)), errors.join('\n'));
});

test('control: a log that exists with a rustc error still rejects the job', () => {
  const { s, cfg, job, repo } = setup();
  try {
    const run = (cmd, { logPath }) => { writeFileSync(logPath, RUSTC_LOG); return { ...CANCELLED, cancelled: false, exit: 101 }; };
    const rejected = precheckJob(cfg, job, repo, { run, busy: () => false });
    assert.equal(rejected.status, 'failed');
    assert.deepEqual(Object.keys(rejected.commands[0].errors), ['crates/x/src/lib.rs']);
  } finally { s.done(); }
});

test('a command cancelled while it waits for its build slot leaves an empty log at logPath', () => {
  const slots = mkdtempSync(join(tmpdir(), 'slots-'));
  const out = mkdtempSync(join(tmpdir(), 'run-'));
  process.env.CLAUDE_KIT_BUILD_SLOT_DIR = slots;
  try {
    writeFileSync(join(slots, 'slot-0'), JSON.stringify({ pid: process.pid, host: hostname(), label: 'held' }));
    const logPath = join(out, 'cancelled.log');
    const r = runCancellable('cargo build', { cwd: out, targetDir: out, logPath, jobs: 1000 }, { shouldCancel: () => true });
    assert.equal(r.cancelled, true);
    assert.equal(existsSync(logPath), true);
  } finally {
    delete process.env.CLAUDE_KIT_BUILD_SLOT_DIR;
    rmSync(slots, { recursive: true, force: true });
    rmSync(out, { recursive: true, force: true });
  }
});
