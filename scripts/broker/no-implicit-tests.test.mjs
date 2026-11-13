// no-implicit-tests.test.mjs — the broker starts no test the worker did not name (KIT-D162, KIT-D163, KIT-T1115). Defaults are read
// without the fixtures' legacy-defaults switch; the commands a patch runs are asserted, and each implicit run has its one setting.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { landGate } from './landgate.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const TESTS = /\b(test|t|nextest)\b/;
const realDefaults = (broker = {}) => {
  const saved = process.env.BROKER_LEGACY_DEFAULTS;
  delete process.env.BROKER_LEGACY_DEFAULTS;
  try { return normalizeBroker(tempDir('nit-cfg-'), broker); } finally { if (saved !== undefined) process.env.BROKER_LEGACY_DEFAULTS = saved; }
};

const LAYOUT = {
  'Cargo.toml': '[workspace]\nmembers = ["crates/a", "crates/b"]\n',
  'crates/a/Cargo.toml': '[package]\nname = "a"\n',
  'crates/a/src/lib.rs': '',
  'crates/a/tests/t.rs': 'use a::x;\n',
  'crates/b/Cargo.toml': '[package]\nname = "b"\n',
  'crates/b/src/lib.rs': '',
};
const layout = () => {
  const dir = tempDir('nit-ws-');
  for (const [p, text] of Object.entries(LAYOUT)) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), text); }
  return dir;
};
const files = (...paths) => new Map(paths.map((p) => [p, { text: 'x' }]));

test('defaults: no verify_default, the check gate over touched packages, no attribution re-runs, no idle re-runs', () => {
  const cfg = realDefaults();
  assert.deepEqual(cfg.verifyDefault, []);
  assert.equal(cfg.landGate, 'check');
  assert.equal(cfg.patchCheck, 'touched');
  assert.equal(cfg.attributeFailures, false);
  assert.equal(cfg.recheckDeferred, false);
  assert.deepEqual(cfg.suite, ['cargo test --no-fail-fast'], 'the approved suite keeps its own default');
});

test('each implicit run has one setting that turns it on', () => {
  const cfg = realDefaults({ land_gate: 'affected', patch_check: 'workspace', attribute_failures: true, recheck_deferred: true, verify_default: ['cargo test -p x'] });
  assert.deepEqual([cfg.landGate, cfg.patchCheck, cfg.attributeFailures, cfg.recheckDeferred, cfg.verifyDefault, cfg.suite], ['affected', 'workspace', true, true, ['cargo test -p x'], ['cargo test -p x']]);
  assert.equal(realDefaults({ patch_check: 'off' }).patchCheck, 'off');
  assert.equal(realDefaults({ land_gate: 'full' }).landGate, 'full');
});

test('a patch that names no test: the landing gate runs one compile check of the touched package and no test', () => {
  const dir = layout();
  const cfg = realDefaults();
  try {
    const gate = landGate(cfg, dir, { commands: [] }, files('crates/a/src/lib.rs'));
    assert.deepEqual(gate.commands, ['cargo check -p a --all-targets']);
    assert.ok(!gate.commands.some((c) => TESTS.test(c.replace(/^cargo check/, ''))), 'no test command');
    assert.deepEqual(landGate(cfg, dir, { commands: [] }, files('crates/a/src/lib.rs', 'crates/b/src/lib.rs')).commands, ['cargo check -p a -p b --all-targets']);
    assert.deepEqual(landGate(cfg, dir, { commands: [] }, files('docs/readme.md')).commands, [], 'a doc starts nothing');
    assert.deepEqual(landGate(cfg, dir, { commands: [] }, files('Cargo.toml')).commands, ['cargo check --workspace --all-targets'], 'a path the map cannot place falls back to the whole check, still no test');
  } finally { cleanup(dir); }
});

test('a patch that names a test runs that test after the check, and nothing else', () => {
  const dir = layout();
  const cfg = realDefaults();
  try {
    const gate = landGate(cfg, dir, { commands: ['cargo t -p a --test t'] }, files('crates/a/src/lib.rs'));
    assert.deepEqual(gate.commands, ['cargo check -p a --all-targets', 'cargo t -p a --test t']);
    assert.deepEqual(gate.selection.dropped, []);
    const suite = landGate(cfg, dir, { commands: ['cargo test'] }, files('crates/a/src/lib.rs'));
    assert.deepEqual(suite.commands, ['cargo check -p a --all-targets'], 'a suite-shaped command still leaves the gate');
  } finally { cleanup(dir); }
});

test('negative controls: land_gate affected maps tests again; patch_check workspace and off change only the check', () => {
  const dir = layout();
  try {
    const affected = landGate(realDefaults({ land_gate: 'affected' }), dir, { commands: [] }, files('crates/a/src/lib.rs'));
    assert.ok(affected.commands.some((c) => c.startsWith('cargo test -p a')), 'the opt-in gate runs the mapped tests');
    assert.deepEqual(landGate(realDefaults({ patch_check: 'workspace' }), dir, { commands: [] }, files('crates/a/src/lib.rs')).commands, ['cargo check --workspace --all-targets']);
    assert.deepEqual(landGate(realDefaults({ patch_check: 'off' }), dir, { commands: [] }, files('crates/a/src/lib.rs')).commands, []);
  } finally { cleanup(dir); }
});

const counter = (dir, name) => {
  const file = join(dir, name).replace(/\\/g, '/');
  return { file, cmd: `node -e "require('fs').appendFileSync('${file}','x')"`, runs: () => (existsSync(file) ? readFileSync(file, 'utf8').length : 0) };
};

function submit(s, flags, commands) {
  const { job } = buildPatchJob(s.cfg, flags, envelope(['beta', 'BETA']));
  writeJob(s.cfg, { ...job, commands });
  processOnce(s.cfg);
  return readResult(s.cfg, job.id);
}

test('daemon: a patch with no test command runs the compile check only; the project\'s verify_default is the old behaviour', () => {
  const s = fixture();
  const dir = tempDir('nit-run-');
  const check = counter(dir, 'check');
  const verify = counter(dir, 'verify');
  try {
    Object.assign(s.cfg, { landGate: 'check', patchCheck: 'workspace', verifyDefault: [], affected: { ...s.cfg.affected, check: check.cmd } });
    const r = submit(s, { ticket: 'T-1' }, []);
    assert.equal(r.status, 'passed', JSON.stringify(r));
    assert.deepEqual(r.commands.map((c) => c.cmd), [check.cmd]);
    assert.deepEqual([check.runs(), verify.runs()], [1, 0]);

    Object.assign(s.cfg, { patchCheck: 'off' });
    assert.deepEqual(submit(s, { ticket: 'T-1' }, []).commands, [], 'patch_check off: apply and the pre-write gate only, no process starts');

    Object.assign(s.cfg, { patchCheck: 'workspace', verifyDefault: [verify.cmd] });
    const old = submit(s, { ticket: 'T-1' }, []);
    assert.deepEqual(old.commands.map((c) => c.cmd), [check.cmd, verify.cmd], 'negative control: a project that sets verify_default gets it');
    assert.equal(verify.runs(), 1);
  } finally { s.done(); cleanup(dir); }
});

const failing = (counterFile) => `node -e "require('fs').appendFileSync('${counterFile}','x');console.log('test a_foreign ... FAILED');process.exit(1)"`;

test('daemon: a failed named test is not re-run on the pre-patch tree unless attribute_failures is on', () => {
  for (const [on, runs, status] of [[false, 1, 'failed'], [true, 2, 'passed']]) {
    const s = fixture();
    const dir = tempDir('nit-attr-');
    const seen = counter(dir, 'seen');
    try {
      Object.assign(s.cfg, { landGate: 'full', attributeFailures: on, recheckDeferred: false });
      const r = submit(s, { ticket: 'T-1' }, [failing(seen.file)]);
      assert.deepEqual([r.status, seen.runs()], [status, runs], `attribute_failures ${on}`);
    } finally { s.done(); cleanup(dir); }
  }
});
