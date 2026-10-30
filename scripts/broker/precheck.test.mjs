// precheck.mjs + the submit-time write gate (KIT-D115): a compile error or a gate failure is rejected at submit and never
// takes a queue slot; every other precheck outcome lets the job queue.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { precheckJob } from './precheck.mjs';
import { parseEnvelope } from './envelope.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture, snapshot } from './patchkit.mjs';

const RUSTC_ERROR = String.raw`node -e "console.error('error[E0308]: mismatched types'); console.error(' --> crates/x/src/lib.rs:3:5'); process.exit(101)"`;
const OTHER_FAILURE = String.raw`node -e "console.error('error: could not find Cargo.toml'); process.exit(101)"`;
const PASSES = String.raw`node -e "process.exit(0)"`;
const SLOW = String.raw`node -e "setTimeout(() => {}, 20000)"`;

function setup(check, extra = {}) {
  const s = fixture();
  const cfg = { ...s.cfg, precheck: true, precheckTimeoutMs: 30000, affected: { ...s.cfg.affected, check }, ...extra };
  const { job } = buildPatchJob(cfg, { ticket: 'KIT-T1' }, envelope(['beta', 'BETA']));
  return { s, cfg, job, repo: cfg.repos[0] };
}

test('a rustc error in the patch is rejected at submit: a failed result in phase precheck, the live tree untouched, nothing queued', () => {
  const { s, cfg, job, repo } = setup(RUSTC_ERROR);
  try {
    const before = snapshot(s.root);
    const rejected = precheckJob(cfg, job, repo);
    assert.equal(rejected.status, 'failed');
    assert.equal(rejected.phase, 'precheck');
    assert.equal(rejected.id, job.id);
    assert.match(rejected.message, /never entered the queue/);
    assert.deepEqual(Object.keys(rejected.commands[0].errors), ['crates/x/src/lib.rs']);
    assert.deepEqual(snapshot(s.root), before, 'the precheck wrote in its own tree');
    assert.equal(existsSync(join(cfg.targetDir, 'broker', 'precheck', 'app')), true, 'its own persistent tree');
  } finally { s.done(); }
});

test('control: a check that passes lets the job queue', () => {
  const { s, cfg, job, repo } = setup(PASSES);
  try { assert.equal(precheckJob(cfg, job, repo), null); } finally { s.done(); }
});

test('control: a failure with no rustc error (an infrastructure problem) fails open', () => {
  const { s, cfg, job, repo } = setup(OTHER_FAILURE);
  try { assert.equal(precheckJob(cfg, job, repo), null); } finally { s.done(); }
});

test('control: a precheck that runs past its timeout fails open and leaves nothing running', () => {
  const { s, cfg, job, repo } = setup(SLOW, { precheckTimeoutMs: 1500 });
  try {
    const started = Date.now();
    assert.equal(precheckJob(cfg, job, repo), null);
    assert.ok(Date.now() - started < 15000, 'the 20 s command was killed at the timeout');
  } finally { s.done(); }
});

test('control: off, no operations, or a held tree all skip the precheck', () => {
  const { s, cfg, job, repo } = setup(RUSTC_ERROR);
  try {
    assert.equal(precheckJob({ ...cfg, precheck: false }, job, repo), null, 'precheck: false');
    assert.equal(precheckJob(cfg, { ...job, ops: [] }, repo), null, 'no operations');
    const lock = join(cfg.targetDir, 'broker', 'precheck-app.lock');
    mkdirSync(lock, { recursive: true });
    assert.equal(precheckJob({ ...cfg, precheckTimeoutMs: 1500 }, job, repo), null, 'another precheck holds the tree past the wait');
    assert.equal(existsSync(lock), true, 'a held lock is not stolen');
  } finally { s.done(); }
});

test('a precheck that finds the tree held waits for the holder and then checks its own patch (KIT-T728)', () => {
  const { s, cfg, job, repo } = setup(RUSTC_ERROR);
  try {
    const lock = join(cfg.targetDir, 'broker', 'precheck-app.lock');
    mkdirSync(lock, { recursive: true });
    const waits = [];
    const pause = (ms) => { waits.push(ms); rmSync(lock, { recursive: true, force: true }); };
    const rejected = precheckJob(cfg, job, repo, { pause });
    assert.equal(waits.length, 1, 'it waited once for the holder');
    assert.equal(rejected.phase, 'precheck', 'the waited-for check ran and rejected the rustc error');
    assert.equal(existsSync(lock), false, 'its own lock is released');
  } finally { s.done(); }
});

test('a patch that no longer applies at the precheck tree HEAD fails open to the queue', () => {
  const { s, cfg, job, repo } = setup(RUSTC_ERROR);
  try {
    const stale = { ...job, ops: parseEnvelope(envelope(['text that is not there', 'x'])) };
    assert.equal(precheckJob(cfg, stale, repo), null);
  } finally { s.done(); }
});

const longFile = (n) => Array.from({ length: n }, (_, i) => `fn f${i}() {}`).join('\n');

test('the pre-write gate runs at submit: a gate failure is a result, not a queued job; control: a clean patch queues', () => {
  const s = fixture();
  try {
    const bad = buildPatchJob(s.cfg, { ticket: 'KIT-T1' }, `*** write big.rs\n${longFile(700)}\n`);
    assert.equal(bad.job, undefined);
    assert.equal(bad.result.status, 'gate');
    assert.equal(bad.result.phase, 'submit-gate');
    assert.ok(bad.result.gate.some((g) => g.check === 'file-length'));
    assert.ok(buildPatchJob(s.cfg, {}, envelope(['beta', 'BETA'])).job, 'control: clean patch');
    assert.ok(buildPatchJob(s.cfg, { measure: true }, `*** write big.rs\n${longFile(700)}\n`).job.measure, 'a measurement job skips the gate');
  } finally { s.done(); }
});

test('the daemon still gates a job that reached the queue without the submit gate', () => {
  const s = fixture();
  try {
    const clean = buildPatchJob(s.cfg, {}, envelope(['beta', 'BETA'])).job;
    const job = { ...clean, ops: parseEnvelope(`*** write big.rs\n${longFile(700)}\n`) };
    writeJob(s.cfg, job);
    processOnce(s.cfg);
    assert.equal(readResult(s.cfg, job.id).status, 'gate');
  } finally { s.done(); }
});
