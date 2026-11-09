// log-sweep.test.mjs — job logs are removed after LOG_KEEP_DAYS, once a day, from the logs dir and from the broker home
// an older broker wrote precheck logs into (KIT-T914); a precheck now writes its log under logs/.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOG_KEEP_DAYS, sweepLogs } from './log-sweep.mjs';
import { ensureDirs } from './result.mjs';
import { precheckJob } from './precheck.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;
const age = (file, days) => utimesSync(file, (Date.now() - days * DAY_MS) / 1000, (Date.now() - days * DAY_MS) / 1000);
const touch = (file, days = 0) => { writeFileSync(file, 'x'); if (days) age(file, days); };

function paths(dir) {
  const logs = join(dir, 'logs');
  mkdirSync(logs, { recursive: true });
  return { home: dir, logs };
}

test('logs older than the retention go, logs inside it and other files stay', () => {
  const dir = tempDir('sweep-');
  try {
    const p = paths(dir);
    const old = LOG_KEEP_DAYS + 1;
    for (const name of ['j-a-1.log', 'train-j-a-2.log', 'precheck-j-a.log', 'precheck-j-a-full.log', 'precheck-j-a.log.exit', 'daemon-x.log']) touch(join(p.logs, name), old);
    touch(join(p.logs, 'j-fresh-1.log'), 1);
    touch(join(p.logs, 'auto-pin.log'), old);
    touch(join(dir, 'precheck-j-legacy.log'), old);
    touch(join(dir, 'precheck-j-legacy-full.log'), old);
    touch(join(dir, 'precheck-j-legacy.log.exit'), old);
    touch(join(dir, 'precheck-j-recent.log'), 1);
    touch(join(dir, 'broker.lock'), old);
    sweepLogs(p);
    const gone = ['j-a-1.log', 'train-j-a-2.log', 'precheck-j-a.log', 'precheck-j-a-full.log', 'precheck-j-a.log.exit', 'daemon-x.log'].map((n) => join(p.logs, n));
    assert.deepEqual(gone.map(existsSync), gone.map(() => false));
    assert.deepEqual(['precheck-j-legacy.log', 'precheck-j-legacy-full.log', 'precheck-j-legacy.log.exit'].map((n) => existsSync(join(dir, n))), [false, false, false]);
    assert.deepEqual([join(p.logs, 'j-fresh-1.log'), join(p.logs, 'auto-pin.log'), join(dir, 'precheck-j-recent.log'), join(dir, 'broker.lock')].map(existsSync), [true, true, true, true]);
  } finally { cleanup(dir); }
});

test('the sweep runs once a day: a second pass inside the interval leaves old logs alone', () => {
  const dir = tempDir('sweep-once-');
  try {
    const p = paths(dir);
    sweepLogs(p);
    const old = join(p.logs, 'j-b-1.log');
    touch(old, LOG_KEEP_DAYS + 1);
    assert.deepEqual(sweepLogs(p), []);
    assert.equal(existsSync(old), true);
    assert.deepEqual(sweepLogs(p, { now: Date.now() + 2 * DAY_MS }), ['j-b-1.log']);
  } finally { cleanup(dir); }
});

test('ensureDirs sweeps, so any broker command keeps the logs bounded', () => {
  const s = fixture();
  try {
    const p = ensureDirs(s.cfg);
    const old = join(p.logs, 'j-c-1.log');
    touch(old, LOG_KEEP_DAYS + 1);
    touch(join(p.home, 'precheck-j-c.log'), LOG_KEEP_DAYS + 1);
    ensureDirs(s.cfg);
    assert.equal(existsSync(old), true, 'inside the daily interval nothing is swept again');
    cleanup(join(p.home, 'logs-swept'));
    ensureDirs(s.cfg);
    assert.deepEqual([existsSync(old), existsSync(join(p.home, 'precheck-j-c.log'))], [false, false]);
  } finally { s.done(); }
});

test('a precheck writes its log under logs/, not in the broker home', () => {
  const s = fixture();
  try {
    const rustc = String.raw`node -e "console.error('error[E0308]: mismatched types'); console.error(' --> crates/x/src/lib.rs:3:5'); process.exit(101)"`;
    const cfg = { ...s.cfg, precheck: true, precheckTimeoutMs: 30000, affected: { ...s.cfg.affected, check: rustc, fullCheck: rustc } };
    const { job } = buildPatchJob(cfg, { ticket: 'KIT-T1' }, envelope(['beta', 'BETA']));
    const rejected = precheckJob(cfg, job, cfg.repos[0]);
    assert.equal(rejected.commands[0].log, join(ensureDirs(cfg).logs, `precheck-${job.id}.log`));
    assert.equal(existsSync(rejected.commands[0].log), true);
    assert.equal(existsSync(join(ensureDirs(cfg).home, `precheck-${job.id}.log`)), false);
  } finally { s.done(); }
});
