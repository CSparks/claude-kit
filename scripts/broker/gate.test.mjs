// gate.test.mjs — the gate phase (KIT-T276 L3): a patch is held to the kit's pre-write checks
// before anything touches the tree.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gateFile, GATE_CRASH } from './gate.mjs';
import { parseEnvelope } from './envelope.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture, snapshot } from './patchkit.mjs';

const longFile = (n) => Array.from({ length: n }, (_, i) => `fn f${i}() {}`).join('\n');

test('a patch leaving a file over the hard length limit stops at gate; the tree is untouched', () => {
  const s = fixture();
  try {
    const clean = buildPatchJob(s.cfg, {}, envelope(['beta', 'BETA'])).job;
    const job = { ...clean, ops: parseEnvelope(`*** write big.rs\n${longFile(700)}\n`) };
    writeJob(s.cfg, job);
    const before = snapshot(s.root);
    processOnce(s.cfg);
    const r = readResult(s.cfg, job.id);
    assert.equal(r.status, 'gate');
    assert.equal(r.phase, 'gate');
    assert.ok(r.gate.every((e) => e.path === "big.rs"));
    assert.ok(r.gate.some((e) => e.check === "file-length"), JSON.stringify(r.gate));
    assert.equal(r.commands.length, 0, 'no command ran');
    assert.equal(existsSync(join(s.root, 'big.rs')), false);
    assert.deepEqual(snapshot(s.root), before);
  } finally { s.done(); }
});

test('a clean patch passes the gate and runs', () => {
  const s = fixture();
  try {
    const { job } = buildPatchJob(s.cfg, {}, envelope(['beta', 'BETA']));
    writeJob(s.cfg, job);
    processOnce(s.cfg);
    assert.equal(readResult(s.cfg, job.id).status, 'passed');
  } finally { s.done(); }
});

test('a gate hook that vanished (its runtime was pruned) fails the job as runtime-gone, not a module error (KIT-T486)', () => {
  const s = fixture();
  try {
    process.env.BROKER_GATE_HOOK = join(s.root, 'gone', 'hooks', 'pre-write.mjs');
    const { job } = buildPatchJob(s.cfg, { ticket: 'T-1' }, envelope(['beta', 'BETA']));
    writeJob(s.cfg, job);
    processOnce(s.cfg);
    const r = readResult(s.cfg, job.id);
    assert.equal(r.status, 'failed');
    assert.match(r.message, /^runtime gone: .* restart me/);
    assert.doesNotMatch(r.message, /Cannot find module/);
  } finally { delete process.env.BROKER_GATE_HOOK; s.done(); }
});

// A hook that logs each run to `<dir>/runs`, then exits with the first of `codes` not yet used.
function scriptedHook(codes) {
  const dir = mkdtempSync(join(tmpdir(), 'gate-hook-'));
  const hook = join(dir, 'hook.mjs');
  writeFileSync(hook, [
    "import { appendFileSync, readFileSync } from 'node:fs';",
    `const runs = ${JSON.stringify(join(dir, 'runs'))};`,
    `const codes = ${JSON.stringify(codes)};`,
    "appendFileSync(runs, 'x');",
    'const n = readFileSync(runs, "utf8").length;',
    "process.stderr.write('FATAL ERROR: out of memory');",
    'process.exit(codes[Math.min(n, codes.length) - 1]);',
  ].join('\n'));
  return { hook, runs: () => readFileSync(join(dir, 'runs'), 'utf8').length };
}

const withHook = (h, fn) => {
  process.env.BROKER_GATE_HOOK = h.hook;
  process.env.BROKER_GATE_RETRY_MS = '0';
  try { return fn(); } finally { delete process.env.BROKER_GATE_HOOK; delete process.env.BROKER_GATE_RETRY_MS; }
};

test('a hook that aborts once (V8 exit 134) is rerun and the file passes (KIT-T621)', () => {
  const h = scriptedHook([134, 0]);
  assert.deepEqual(withHook(h, () => gateFile(tmpdir(), 'a.rs', 'fn a() {}')), []);
  assert.equal(h.runs(), 2);
});

test('a hook that aborts on every attempt is a gate-crash naming the attempts and the fatal line', () => {
  const h = scriptedHook([134]);
  const found = withHook(h, () => gateFile(tmpdir(), 'a.rs', 'fn a() {}'));
  assert.equal(h.runs(), 3);
  assert.equal(found[0].check, GATE_CRASH);
  assert.match(found[0].msg, /exited 134 on 3 attempts: FATAL ERROR: out of memory/);
});

test('negative control: a hook that blocks (exit 2) is never rerun', () => {
  const h = scriptedHook([2]);
  const found = withHook(h, () => gateFile(tmpdir(), 'a.rs', 'fn a() {}'));
  assert.equal(h.runs(), 1);
  assert.notEqual(found[0].check, GATE_CRASH);
});
