// watchdog.test.mjs — the stall watchdog against landings (KIT-T493, KIT-T488#3): a daemon beats
// through a long pre-push gate and is never killed inside a landing phase; a daemon that dies
// after its commit leaves the tree at the commit and the restart finishes the push; a kill is
// recorded in the job's result; `stall_kill_s: 0` never kills.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { brokerPaths, normalizeBroker } from './config.mjs';
import { recoverInflight, readInflight } from './preimage.mjs';
import { ensureDirs, readResult, writeJob, writeResult } from './result.mjs';
import { restartIfWedged } from './stall.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture, g, originSha } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const BROKER = join(import.meta.dirname, 'broker.mjs');
const PASS = 'node -e "0"';
const GATE_S = 5;
const LATER_MS = 30 * 60 * 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// A fixture whose repo runs its pre-push hook in the daemon (pre_push: true). The hook sleeps
// GATE_S seconds on its first run only, so the push's own hook run passes at once.
function gated(extra = '') {
  const s = fixture();
  const flagDir = tempDir('gate-flag-');
  const flag = join(flagDir, 'ran').replace(/\\/g, '/');
  writeFileSync(join(s.root, '.git', 'hooks', 'pre-push'), `#!/bin/sh\nif [ ! -f "${flag}" ]; then touch "${flag}"; sleep ${GATE_S}; fi\nexit 0\n`, { mode: 0o755 });
  writeFileSync(join(s.root, '.ai', 'config.yml'), `broker:\n${extra}  repos:\n    - { name: app, path: ., main: main, remote: origin, pre_push: true }\n`);
  const cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin', pre_push: true }] });
  const { job } = buildPatchJob(cfg, { ticket: 'T-1', title: 'gated landing', land: true }, envelope(['beta', 'BETA']));
  writeJob(cfg, { ...job, commands: [PASS] });
  return { ...s, cfg, job, done: () => { s.done(); cleanup(flagDir); } };
}

const daemon = (root) => spawn(process.execPath, [BROKER, '--root', root, '--once'], { stdio: 'ignore', windowsHide: true });
const exited = (child) => new Promise((r) => (child.exitCode !== null ? r(child.exitCode) : child.on('exit', r)));
const phaseOf = (cfg) => { try { return JSON.parse(readFileSync(join(brokerPaths(cfg).home, 'phase.json'), 'utf8')).phase; } catch { return null; } };
const beatAge = (cfg) => { try { return Date.now() - statSync(brokerPaths(cfg).beat).mtimeMs; } catch { return Infinity; } };

async function untilPhase(cfg, phase, limitMs = 60_000) {
  const end = Date.now() + limitMs;
  while (phaseOf(cfg) !== phase) { if (Date.now() > end) throw new Error(`never reached ${phase} (at ${phaseOf(cfg)})`); await sleep(50); }
}

test('a landing inside a pre-push gate longer than the kill limit keeps beating and is never killed', async () => {
  const s = gated('  stall_kill_s: 1\n');
  try {
    const child = daemon(s.root);
    await untilPhase(s.cfg, 'pre-push gate');
    let worst = 0;
    const killed = [];
    const cfg = { ...s.cfg, stallKillS: 1 };
    while (phaseOf(s.cfg) === 'pre-push gate') {
      worst = Math.max(worst, beatAge(s.cfg));
      assert.equal(restartIfWedged(cfg, s.root, { now: Date.now() + LATER_MS, kill: (pid) => killed.push(pid), spawner: () => {} }), false);
      await sleep(200);
    }
    await exited(child);
    assert.ok(worst < 2500, `the beat stayed fresh through the gate (worst ${worst} ms)`);
    assert.deepEqual(killed, [], 'a silent-looking landing is not killed');
    assert.equal(readResult(s.cfg, s.job.id).status, 'landed');
  } finally { s.done(); }
});

test('negative control: the same watchdog kills a daemon stalled outside a landing, and the kill lands in the result', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    writeFileSync(brokerPaths(s.cfg).lock, JSON.stringify({ pid: process.pid, host: hostname(), ts: new Date().toISOString() }));
    writeFileSync(brokerPaths(s.cfg).beat, '');
    writeJob(s.cfg, { id: 'j-1-a', repo: 'app', ops: [] });
    writeFileSync(join(brokerPaths(s.cfg).home, 'inflight.json'), JSON.stringify({ id: 'j-1-a', cwd: s.root, startedAt: new Date().toISOString(), entries: [] }));
    writeFileSync(join(brokerPaths(s.cfg).home, 'phase.json'), JSON.stringify({ id: 'j-1-a', phase: 'run', since: new Date().toISOString() }));
    const killed = [];
    assert.equal(restartIfWedged({ ...s.cfg, stallKillS: 0 }, s.root, { now: Date.now() + LATER_MS, kill: (pid) => killed.push(pid) }), false, 'stall_kill_s: 0 never kills');
    assert.equal(restartIfWedged(s.cfg, s.root, { now: Date.now() + LATER_MS, kill: (pid) => killed.push(pid), spawner: () => {} }), true);
    assert.deepEqual(killed, [process.pid]);
    const r = writeResult(s.cfg, { id: 'j-1-a', status: 'failed' });
    assert.equal(r.killed.pid, process.pid);
    assert.equal(r.killed.phase, 'run');
    assert.equal(writeResult(s.cfg, { id: 'j-1-a', status: 'failed' }).killed, undefined, 'the kill is reported once');
  } finally { s.done(); }
});

test('a daemon that dies after its commit leaves the tree at the commit; the restart finishes the push', async () => {
  const s = gated();
  try {
    const head = g(['rev-parse', 'HEAD'], s.root);
    const first = daemon(s.root);
    await untilPhase(s.cfg, 'pre-push gate');
    first.kill('SIGKILL');
    await exited(first);
    const journal = readInflight(s.cfg);
    assert.ok(journal && journal.committed, 'the journal was re-based at the commit');
    assert.notEqual(g(['rev-parse', 'HEAD'], s.root), head, 'the commit exists locally');
    assert.equal(g(['status', '--porcelain'], s.root), '?? .ai/', 'the tree matches the commit');
    writeFileSync(join(brokerPaths(s.cfg).home, 'broker.lock'), '');
    const second = daemon(s.root);
    await exited(second);
    const r = readResult(s.cfg, s.job.id);
    assert.equal(r.status, 'landed');
    assert.equal(r.resumed.sha, journal.committed.sha);
    assert.equal(originSha(s.bare, s.root), g(['rev-parse', 'HEAD'], s.root), 'pushed');
    assert.equal(g(['status', '--porcelain'], s.root), '?? .ai/');
    assert.equal(readInflight(s.cfg), null);
  } finally { s.done(); }
});

test('negative control: a journal without the commit marker restores pre-images over the commit (the tree goes reverse of HEAD)', async () => {
  const s = gated();
  try {
    const first = daemon(s.root);
    await untilPhase(s.cfg, 'pre-push gate');
    first.kill('SIGKILL');
    await exited(first);
    const { committed, ...old } = readInflight(s.cfg);
    assert.ok(committed);
    writeFileSync(join(brokerPaths(s.cfg).home, 'inflight.json'), JSON.stringify(old));
    assert.deepEqual(recoverInflight(s.cfg), { id: old.id, resume: null });
    assert.match(g(['status', '--porcelain'], s.root), /^M src\.txt/m, 'pre-images over a commit leave the tree reversed');
  } finally { s.done(); }
});

test('the kill limit reads stall_kill_s; absent keeps the default', () => {
  assert.equal(normalizeBroker('/r', { stall_kill_s: 0 }).stallKillS, 0);
  assert.equal(normalizeBroker('/r', { stall_kill_s: 1800 }).stallKillS, 1800);
  assert.equal(normalizeBroker('/r', {}).stallKillS, null);
  assert.ok(existsSync(BROKER));
});
