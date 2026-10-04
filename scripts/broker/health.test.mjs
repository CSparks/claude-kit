// health.test.mjs — the broker's self-check (KIT-T307): each detection fires on its fault and
// stays silent on a healthy twin; health.json carries { kind, since, detail, cause }; the
// session hooks print one line per entry.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { healthWarnings } from './health-read.mjs';
import { selfCheck, OWN_DIRT_WINDOW_MS } from './health.mjs';
import { readHealth, readRun, recordFault, recordRun } from './health-store.mjs';
import { capture, restore, restoreMismatches } from './preimage.mjs';
import { processOnce } from './queue.mjs';
import { ensureDirs, readResult, writeJob, writeResult } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture, g } from './patchkit.mjs';
import { adopted, cleanup as cleanupHarness, hook, tmpDir } from '../../hooks/test-harness.mjs';

const PASS = 'node -e "process.exit(0)"';
const queueJob = (s) => writeJob(s.cfg, { ...buildPatchJob(s.cfg, {}, '*** write p.txt\np\n').job, commands: [PASS] });
const liveLock = (s) => ensureDirs(s.cfg) && writeFileSync(brokerPaths(s.cfg).lock, JSON.stringify({ pid: process.pid, host: hostname(), ts: new Date().toISOString() }));
const kinds = (r) => r.entries.map((e) => e.kind);
const touch = (abs, ms) => utimesSync(abs, new Date(ms), new Date(ms));

test('jobs queued with no live daemon: one entry with kind, since, detail and cause; a live daemon or an empty queue is healthy', () => {
  const s = fixture();
  try {
    assert.deepEqual(selfCheck(s.cfg).entries, [], 'empty queue');
    queueJob(s);
    assert.deepEqual(kinds(selfCheck(s.cfg)), ['no-daemon']);
    const [e] = readHealth(s.cfg);
    assert.deepEqual(Object.keys(e).sort(), ['cause', 'detail', 'kind', 'since']);
    assert.match(e.cause, /cap bug/);
    assert.equal(selfCheck(s.cfg, { now: Date.now() + 5000 }).fresh.length, 0, 'a continuing entry is not fresh');
    assert.equal(readHealth(s.cfg)[0].since, e.since, 'since survives');
    liveLock(s);
    assert.deepEqual(selfCheck(s.cfg).entries, []);
    assert.deepEqual(readHealth(s.cfg), [], 'empty when healthy');
  } finally { s.done(); }
});

// A paused queue: src.txt dirty, the last run journalled it, a dirty result sits beside the queued job.
function pausedOnOwnDirt(s, mtimeOffsetMs) {
  liveLock(s);
  const head = g(['rev-parse', 'HEAD:src.txt'], s.root);
  recordRun(s.cfg, { id: 'j-prev', repo: 'app', kind: 'job', startedAt: new Date(Date.now() - 20_000).toISOString(), entries: [{ path: 'src.txt', blob: head }] });
  writeFileSync(join(s.root, 'src.txt'), 'broker left this\n');
  touch(join(s.root, 'src.txt'), Date.now() + mtimeOffsetMs);
  const job = queueJob(s);
  writeResult(s.cfg, { id: job.id, repo: 'app', status: 'dirty', phase: 'apply', dirtyEntries: ['M src.txt'] });
}

test('a pause on a path the last run journalled is reported, and healed from the journal when it was clean going in', () => {
  const s = fixture();
  try {
    pausedOnOwnDirt(s, 0);
    const seen = selfCheck(s.cfg);
    assert.deepEqual(kinds(seen), ['dirt-from-own-run']);
    assert.match(seen.entries[0].detail, /src\.txt.*j-prev/);
    assert.equal(readFileSync(join(s.root, 'src.txt'), 'utf8'), 'broker left this\n', 'detect-only leaves the tree');
    const healed = selfCheck(s.cfg, { heal: true });
    assert.match(healed.entries[0].detail, /restored src\.txt/);
    assert.equal(readFileSync(join(s.root, 'src.txt'), 'utf8'), 'alpha\nbeta\ngamma\n');
    assert.deepEqual(selfCheck(s.cfg).entries, [], 'healed tree reads healthy');
  } finally { s.done(); }
});

test('negative: a maintainer edit from before the run, or far after an unjournalled run, is not the broker\'s dirt and is never healed', () => {
  const before = fixture();
  const after = fixture();
  try {
    pausedOnOwnDirt(before, -3_600_000);
    assert.deepEqual(selfCheck(before.cfg, { heal: true }).entries, []);
    assert.equal(readFileSync(join(before.root, 'src.txt'), 'utf8'), 'broker left this\n');
    pausedOnOwnDirt(after, OWN_DIRT_WINDOW_MS + 600_000);
    recordRun(after.cfg, { id: 'j-prev', repo: 'app', kind: 'recheck', startedAt: new Date(Date.now() - 20_000).toISOString(), entries: [] });
    assert.deepEqual(selfCheck(after.cfg, { heal: true }).entries, []);
    assert.equal(readFileSync(join(after.root, 'src.txt'), 'utf8'), 'broker left this\n');
  } finally { before.done(); after.done(); }
});

test('a finished job records what it journalled', () => {
  const s = fixture();
  try {
    const job = queueJob(s);
    processOnce(s.cfg);
    const run = readRun(s.cfg);
    assert.deepEqual([run.id, run.repo, run.kind, run.entries.map((e) => e.path)], [job.id, 'app', 'job', ['p.txt']]);
  } finally { s.done(); }
});

test('an inflight job older than 3x the longest recent command is stuck; a younger one, or no daemon, is not', () => {
  const s = fixture();
  try {
    liveLock(s);
    writeResult(s.cfg, { id: 'j-old', repo: 'app', status: 'passed', commands: [{ durationMs: 1000 }, { durationMs: 4000 }] });
    const journal = capture(s.cfg, { id: 'j-run', cwd: s.root, paths: [] });
    const t0 = Date.parse(journal.startedAt);
    assert.deepEqual(selfCheck(s.cfg, { now: t0 + 11_000, stuckFloorMs: 1000 }).entries, [], '11s < 12s limit');
    const r = selfCheck(s.cfg, { now: t0 + 13_000, stuckFloorMs: 1000 });
    assert.deepEqual(kinds(r), ['stuck-inflight']);
    assert.match(r.entries[0].detail, /j-run.*12s limit/);
    writeFileSync(brokerPaths(s.cfg).lock, JSON.stringify({ pid: spawnSync(process.execPath, ['-e', '0']).pid, host: hostname(), ts: 'x' }));
    assert.deepEqual(selfCheck(s.cfg, { now: t0 + 13_000, stuckFloorMs: 1000 }).entries, [], 'no daemon: a crash leftover, not a stuck job');
  } finally { s.done(); }
});

test('a crashing gate fails the job and is recorded as the broker\'s fault; a healthy run records none', () => {
  const s = fixture();
  const crash = join(tmpDir('crash-hook-'), 'crash.mjs');
  writeFileSync(crash, 'process.exit(1);\n');
  try {
    liveLock(s);
    process.env.BROKER_GATE_HOOK = crash;
    const job = queueJob(s);
    processOnce(s.cfg);
    delete process.env.BROKER_GATE_HOOK;
    const res = readResult(s.cfg, job.id);
    assert.deepEqual([res.status, res.phase], ['failed', 'gate']);
    assert.match(res.message, /broker's fault/);
    const r = selfCheck(s.cfg);
    assert.deepEqual(kinds(r), ['own-fault:gate-crash']);
    assert.match(r.entries[0].detail, new RegExp(job.id));
  } finally { delete process.env.BROKER_GATE_HOOK; s.done(); }
  const ok = fixture();
  try {
    liveLock(ok);
    queueJob(ok);
    processOnce(ok.cfg);
    assert.deepEqual(selfCheck(ok.cfg).entries, [], 'a healthy run records no fault');
  } finally { ok.done(); }
});

test('a tree that differs from its journal after the restore is detected; a faithful restore is not', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    const journal = capture(s.cfg, { id: 'j-m', cwd: s.root, paths: ['src.txt'] });
    writeFileSync(join(s.root, 'src.txt'), 'drifted\n');
    assert.deepEqual(restoreMismatches(journal), ['src.txt']);
    restore(s.cfg, journal);
    assert.deepEqual(restoreMismatches(journal), []);
    liveLock(s);
    recordFault(s.cfg, { kind: 'restore-mismatch', id: 'j-m', detail: 'after the restore src.txt differ(s) from the journal' });
    assert.deepEqual(kinds(selfCheck(s.cfg)), ['own-fault:restore-mismatch']);
  } finally { s.done(); }
});

test('session hooks print one line per entry; a healthy broker prints nothing', () => {
  const dir = adopted(false);
  try {
    const home = join(dir, 'target', 'broker');
    mkdirSync(home, { recursive: true });
    assert.deepEqual(healthWarnings(dir), [], 'no file');
    writeFileSync(join(home, 'health.json'), '[]');
    assert.deepEqual(healthWarnings(dir), []);
    writeFileSync(join(home, 'health.json'), JSON.stringify([{ kind: 'no-daemon', since: 'T', detail: '2 jobs queued', cause: 'it exited' }]));
    assert.equal(healthWarnings(dir).length, 1);
    assert.match(hook('orient.mjs', { hook_event_name: 'SessionStart' }, dir).out, /broker no-daemon since T: 2 jobs queued/);
    assert.match(hook('flush.mjs', { hook_event_name: 'Stop' }, dir).out, /broker no-daemon since T: 2 jobs queued/);
    writeFileSync(join(home, 'health.json'), '[]');
    assert.doesNotMatch(hook('flush.mjs', { hook_event_name: 'Stop' }, dir).out, /broker no-daemon/);
  } finally { cleanupHarness(); }
});
