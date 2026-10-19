// hand-hold.test.mjs — a lane paused on hand edits says who holds the tree, since when and which paths
// (KIT-T568): the job's result and message, wait.mjs, `status`, the self-check after 5 minutes, and a
// daemon started over an already dirty tree. Control: a clean tree reports nothing.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordTurnWrite } from '../../hooks/turn-writes.mjs';
import { ensureBroker } from './ensure.mjs';
import { HAND_HOLD_REPORT_MS, dirtNotice, holdAge, holdLine, holdReport } from './hand-hold.mjs';
import { readHold } from './dirty.mjs';
import { selfCheck } from './health.mjs';
import { processOnce } from './queue.mjs';
import { printResult } from './report.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, fixture, g } from './patchkit.mjs';

const WAIT = join(import.meta.dirname, 'wait.mjs');
const BROKER = join(import.meta.dirname, 'broker.mjs');
const SESSION = 'a1b2c3d4-0000-4000-8000-feedfacecafe';
const MIN = 60_000;

// A queued job refused because lib.rs (a build input) carries a hand edit recorded in `SESSION`'s write ledger.
function heldTree() {
  const s = fixture();
  commitOnMain(s.root, 'lib.rs', 'fn a() {}\n', 'add lib');
  const turnState = mkdtempSync(join(tmpdir(), 'hold-turn-'));
  process.env.CLAUDE_KIT_TURN_STATE = turnState;
  const { job } = buildPatchJob(s.cfg, { ticket: 'T-1', title: 'beta' }, '*** write extra.txt\nnew\n');
  writeJob(s.cfg, { ...job, commands: ['node -e "0"'] });
  writeFileSync(join(s.root, 'lib.rs'), 'hand edit\n');
  recordTurnWrite(s.root, join(s.root, 'lib.rs'), SESSION);
  processOnce(s.cfg);
  return { ...s, job, done: () => { delete process.env.CLAUDE_KIT_TURN_STATE; rmSync(turnState, { recursive: true, force: true }); s.done(); } };
}

test('the dirty result and its message name the paths, and the pause marker keeps the first refusal time', () => {
  const t = heldTree();
  try {
    const r = readResult(t.cfg, t.job.id);
    assert.equal(r.status, 'dirty');
    assert.match(r.message, /lib.rs/);
    assert.deepEqual(r.dirtyEntries, ['M lib.rs']);
    const mark = readHold(t.cfg);
    assert.deepEqual(mark.entries, ['M lib.rs']);
    processOnce(t.cfg);
    assert.equal(readHold(t.cfg).since, mark.since, 'a later poll does not move since');
  } finally { t.done(); }
});

test('holdReport names the paths, the hold time and the session whose write ledger has them', () => {
  const t = heldTree();
  try {
    const r = holdReport(t.cfg, Date.now() + 7 * MIN);
    assert.deepEqual(r.entries, ['M lib.rs']);
    assert.equal(r.job, t.job.id);
    assert.equal(r.sessions[0].session, SESSION);
    assert.ok(r.ageMs >= 7 * MIN - 5000);
    assert.match(holdLine(r), /hand edits hold the app tree since \d\d:\d\d: M lib.rs; probably session a1b2c3d4 \(1 of 1 paths/);
    assert.match(holdAge(r), /^7 min, newest edit \d+ s ago$/);
  } finally { t.done(); }
});

test('control: a clean tree has no hold report, no self-check entry and no startup notice', () => {
  const t = heldTree();
  try {
    g(['checkout', '--', 'lib.rs'], t.root);
    assert.equal(holdReport(t.cfg), null);
    assert.deepEqual(selfCheck(t.cfg, { now: Date.now() + 10 * MIN, skipNoDaemon: true }).entries, []);
    assert.deepEqual(dirtNotice(t.cfg), []);
  } finally { t.done(); }
});

test('the self-check raises hand-edit-hold only past the threshold, with a stable detail', () => {
  const t = heldTree();
  try {
    const early = selfCheck(t.cfg, { now: Date.now() + HAND_HOLD_REPORT_MS / 2, skipNoDaemon: true });
    assert.deepEqual(early.entries.map((e) => e.kind), []);
    const late = selfCheck(t.cfg, { now: Date.now() + HAND_HOLD_REPORT_MS + MIN, skipNoDaemon: true });
    const [e] = late.entries;
    assert.equal(e.kind, 'hand-edit-hold');
    assert.match(e.detail, /lib.rs/);
    assert.match(e.cause, /commit or revert/);
    const again = selfCheck(t.cfg, { now: Date.now() + 2 * HAND_HOLD_REPORT_MS, skipNoDaemon: true });
    assert.equal(again.fresh.length, 0, 'a continuing hold is announced once');
    assert.equal(again.entries[0].since, e.since);
  } finally { t.done(); }
});

test('printResult lists every dirty path and says the job stays queued', () => {
  const lines = [];
  printResult({ id: 'j-1', repo: 'app', status: 'dirty', phase: 'apply', message: 'm', dirtyEntries: ['M a.rs', '?? b.rs'] }, (l) => lines.push(l));
  assert.ok(lines.includes('  dirty: M a.rs') && lines.includes('  dirty: ?? b.rs'), lines.join('\n'));
  assert.ok(lines.some((l) => /stays queued/.test(l)));
});

test('wait on a dirty job prints the paths and the probable holder at once, exit 1', () => {
  const t = heldTree();
  try {
    const r = spawnSync(process.execPath, [WAIT, t.job.id, '--root', t.root, '--timeout', '5', '--poll', '100'], { encoding: 'utf8', env: { ...process.env, BROKER_NO_AUTOSTART: '1' } });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /dirty: M lib.rs/);
    assert.match(r.stdout, /hand edits hold the app tree since .*probably session a1b2c3d4/);
  } finally { t.done(); }
});

test('status names the hold, the paths and the session', () => {
  const t = heldTree();
  try {
    const r = spawnSync(process.execPath, [BROKER, 'status', '--root', t.root], { encoding: 'utf8', env: { ...process.env, BROKER_NO_AUTOSTART: '1' } });
    assert.match(r.stderr, /hand edits hold the app tree since .*M lib.rs.*session a1b2c3d4.*min, newest edit/);
  } finally { t.done(); }
});

test('starting a daemon over a dirty tree names the paths and the session on the starter\'s stderr', () => {
  const t = heldTree();
  const said = [];
  const real = console.error;
  console.error = (line) => said.push(String(line));
  try {
    assert.equal(ensureBroker(t.cfg, t.root, () => ({ ok: true })), true);
  } finally { console.error = real; t.done(); }
  assert.ok(said.some((l) => /the app tree is dirty: M lib.rs \(probably session a1b2c3d4\); 1 queued job\(s\) pause/.test(l)), said.join('\n'));
});
