// precheck guards (KIT-D115 follow-up): a touched script must parse, and a cold precheck target never builds beside a running job.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { precheckJob } from './precheck.mjs';
import { scriptSyntaxFailures } from './syntax-check.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture } from './patchkit.mjs';

const PASSES = String.raw`node -e "process.exit(0)"`;
const GOOD_SCRIPT = 'export const answer = () => 1 + 1;\n';
const BROKEN_SCRIPT = 'export const answer = () => { return (1 + ;\n';

function setup(files, extra = {}) {
  const s = fixture();
  const cfg = { ...s.cfg, precheck: true, precheckTimeoutMs: 30000, affected: { ...s.cfg.affected, check: PASSES, fullCheck: PASSES }, ...extra };
  const body = Object.entries(files).map(([path, text]) => `*** write ${path}\n${text}`).join('');
  const { job } = buildPatchJob(cfg, { ticket: 'KIT-T1', measure: false }, body);
  return { s, cfg, job, repo: cfg.repos[0] };
}

// A stand-in for the cargo run: it records the command, makes the target dir and the log as cargo does, and returns `result`.
const spy = (result = {}, logText = '') => {
  const calls = [];
  const run = (cmd, opts) => {
    calls.push(cmd);
    mkdirSync(opts.targetDir, { recursive: true });
    writeFileSync(opts.logPath, logText);
    return { cmd, exit: 0, durationMs: 1, logTail: [], cancelled: false, ...result };
  };
  return { calls, run };
};
const coldMarker = (cfg) => join(cfg.targetDir, 'broker', 'precheck-app.cold');

test('a touched .mjs with a syntax error is rejected at submit, naming the file; nothing is queued', () => {
  const { s, cfg, job, repo } = setup({ 'tools/split.mjs': BROKEN_SCRIPT });
  try {
    const rejected = precheckJob(cfg, job, repo);
    assert.equal(rejected.status, 'failed');
    assert.equal(rejected.phase, 'precheck');
    assert.match(rejected.message, /syntax error in tools\/split\.mjs/);
    assert.match(rejected.message, /never entered the queue/);
    assert.deepEqual(Object.keys(rejected.commands[0].errors), ['tools/split.mjs']);
    assert.match(rejected.commands[0].cmd, /node --check tools\/split\.mjs/);
  } finally { s.done(); }
});

test('negative control: a valid script, a non-script file with the same text, and a script the patch did not touch all queue', () => {
  const ok = setup({ 'tools/split.mjs': GOOD_SCRIPT });
  const notAScript = setup({ 'notes.txt': BROKEN_SCRIPT });
  try {
    assert.equal(precheckJob(ok.cfg, ok.job, ok.repo), null, 'valid script');
    assert.equal(precheckJob(notAScript.cfg, notAScript.job, notAScript.repo), null, 'text file is not judged');
    const untouched = scriptSyntaxFailures(ok.s.root, new Map([['notes.txt', { text: BROKEN_SCRIPT }], ['gone.mjs', { text: null }]]));
    assert.deepEqual(untouched, [], 'a deleted script and a non-script are not checked');
  } finally { ok.s.done(); notAScript.s.done(); }
});

test('the syntax check needs no cargo: with no compile check configured a broken script is still rejected', () => {
  const { s, cfg, job, repo } = setup({ 'tools/split.mjs': BROKEN_SCRIPT }, { affected: { check: null } });
  try { assert.equal(precheckJob(cfg, job, repo).phase, 'precheck'); } finally { s.done(); }
});

test('a cold precheck target does not build while a lane is busy; the job queues unchecked', () => {
  const { s, cfg, job, repo } = setup({ 'notes.txt': 'x\n' });
  const { calls, run } = spy();
  try {
    assert.equal(precheckJob(cfg, job, repo, { run, busy: () => 'lane root is running j-1' }), null);
    assert.deepEqual(calls, [], 'cargo check did not start');
  } finally { s.done(); }
});

test('control: a cold target builds while every lane is idle; once a run finishes it also runs beside a running job', () => {
  const { s, cfg, job, repo } = setup({ 'notes.txt': 'x\n' });
  const { calls, run } = spy();
  try {
    assert.equal(precheckJob(cfg, job, repo, { run, busy: () => null }), null);
    assert.equal(calls.length, 1, 'idle: the cold build ran');
    assert.equal(existsSync(coldMarker(cfg)), false, 'a finished run clears the cold marker');
    assert.equal(precheckJob(cfg, job, repo, { run, busy: () => 'lane root is running j-1' }), null);
    assert.equal(calls.length, 2, 'warm: it runs beside the job');
  } finally { s.done(); }
});

test('a target dir that already exists is warm: the precheck runs beside a running job', () => {
  const { s, cfg, job, repo } = setup({ 'notes.txt': 'x\n' });
  try {
    mkdirSync(join(cfg.targetDir, 'broker', 'precheck-target', 'app'), { recursive: true });
    const { calls, run } = spy();
    assert.equal(precheckJob(cfg, job, repo, { run, busy: () => 'lane root is running j-1' }), null);
    assert.equal(calls.length, 1);
  } finally { s.done(); }
});

const CHECK = 'cargo check --offline --workspace --all-targets --features game/tools';
const TEST_RUN = ['cargo test --offline -p game --test near_ring --no-fail-fast -- --nocapture'];
const RUSTC_ERROR = 'error[E0599]: no method named `x`\n --> crates/game/tests/near_ring.rs:92:9\n';

function scoped(extra = {}) {
  const t = setup({ 'notes.txt': 'x\n' }, { affected: { check: CHECK, fullCheck: CHECK }, ...extra });
  return { ...t, job: { ...t.job, commands: TEST_RUN } };
}

test('the job\'s own targets are checked first: the library and the named test binary of its package, flags kept', () => {
  const { s, cfg, job, repo } = scoped();
  const { calls, run } = spy();
  try {
    assert.equal(precheckJob(cfg, job, repo, { run, busy: () => null }), null);
    assert.deepEqual(calls, ['cargo check --offline -p game --lib --test near_ring --features game/tools', CHECK]);
  } finally { s.done(); }
});

test('a compile error in a test binary the job runs rejects it from the first stage; the whole-workspace check never starts', () => {
  const { s, cfg, job, repo } = scoped();
  const { calls, run } = spy({ exit: 101 }, RUSTC_ERROR);
  try {
    const rejected = precheckJob(cfg, job, repo, { run, busy: () => null });
    assert.equal(rejected.phase, 'precheck');
    assert.deepEqual(Object.keys(rejected.commands[0].errors), ['crates/game/tests/near_ring.rs']);
    assert.equal(calls.length, 1, 'rejected without running the second stage');
  } finally { s.done(); }
});

test('a run cut off at the deadline still rejects the job when its log already holds a rustc error', () => {
  const { s, cfg, job, repo } = scoped();
  const { run } = spy({ exit: 1, timedOut: true }, RUSTC_ERROR);
  try {
    assert.equal(precheckJob(cfg, job, repo, { run, busy: () => null }).phase, 'precheck');
  } finally { s.done(); }
});

test('control: the first stage passes and the whole-workspace stage times out with no error: the job queues', () => {
  const { s, cfg, job, repo } = scoped();
  let n = 0;
  const run = (cmd, opts) => {
    mkdirSync(opts.targetDir, { recursive: true });
    writeFileSync(opts.logPath, '');
    return n++ ? { cmd, exit: 1, timedOut: true, durationMs: 1, logTail: [] } : { cmd, exit: 0, durationMs: 1, logTail: [] };
  };
  try {
    assert.equal(precheckJob(cfg, job, repo, { run, busy: () => null }), null);
    assert.equal(n, 2);
  } finally { s.done(); }
});

test('a patch that touches only markdown never starts a cargo check; control: one source file alongside it does', () => {
  const docs = setup({ 'docs/NOTES.md': '# notes\n' });
  const mixed = setup({ 'docs/NOTES.md': '# notes\n', 'notes.txt': 'x\n' });
  try {
    const only = spy();
    assert.equal(precheckJob(docs.cfg, docs.job, docs.repo, { run: only.run, busy: () => null }), null);
    assert.deepEqual(only.calls, [], 'no cargo check for a docs-only patch');
    const both = spy();
    assert.equal(precheckJob(mixed.cfg, mixed.job, mixed.repo, { run: both.run, busy: () => null }), null);
    assert.equal(both.calls.length, 1);
  } finally { docs.s.done(); mixed.s.done(); }
});

test('control: a run that timed out leaves the target cold', () => {
  const { s, cfg, job, repo } = setup({ 'notes.txt': 'x\n' });
  try {
    const { run } = spy({ exit: 1, timedOut: true });
    assert.equal(precheckJob(cfg, job, repo, { run, busy: () => null }), null);
    assert.equal(existsSync(coldMarker(cfg)), true);
    assert.equal(precheckJob(cfg, job, repo, { run: spy().run, busy: () => 'lane root is running j-1' }), null);
    assert.equal(existsSync(coldMarker(cfg)), true, 'still cold: a busy lane keeps it from building');
  } finally { s.done(); }
});
