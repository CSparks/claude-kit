// pin-scope.test.mjs — an auto-pin's gate follows its delta (KIT-T618, KIT-D104): a pin whose changed crates
// are absent from the consumer's Cargo.lock runs the build check only and says so in the landing commit; a
// changed crate in the lock adds the tests of the consumer crates that depend on it, never the full verify;
// a workspace-level file runs the build check; a queued auto-pin that a newer one covers is dropped.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { dropSuperseded } from './autopin-supersede.mjs';
import { readBrokerConfig } from './config.mjs';
import { dependentsOf, readLock } from './cargo-lock.mjs';
import { buildOnly } from './pin-scope.mjs';
import { processOnce } from './queue.mjs';
import { listQueue, readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, g } from './patchkit.mjs';
import { addOrigin, cleanup, makeRepo, tempDir } from './testkit.mjs';

const manifest = (name) => `[package]\nname = "${name}"\nversion = "0.1.0"\nedition = "2021"\n`;
const config = (extra = []) => [
  'broker:',
  '  verify_default:',
  '    - cargo t',
  ...extra,
  '  repos:',
  '    - { name: stiletto, path: ., main: main, remote: origin }',
  '    - { name: rapid-game, path: rapid-game, main: main, remote: origin, submodule: true, pin_in: ., auto_pin: true }',
  '',
].join('\n');
const REGISTRY = 'registry+https://github.com/rust-lang/crates.io-index';
const LOCK = [
  'version = 3', '',
  '[[package]]', 'name = "rg-used"', 'version = "0.1.0"', '',
  '[[package]]', 'name = "app"', 'version = "0.1.0"', 'dependencies = [', ' "rg-used",', ']', '',
  '[[package]]', 'name = "serde"', 'version = "1.0.0"', `source = "${REGISTRY}"`, '',
].join('\n');

// A cargo stand-in first on PATH: it appends its arguments to $SHIM_LOG and exits 0.
function cargoShim() {
  const dir = tempDir('ps-shim-');
  const log = join(dir, 'cargo.log');
  writeFileSync(join(dir, 'cargo.cmd'), '@echo %* >> "%SHIM_LOG%"\r\n@exit /b 0\r\n');
  writeFileSync(join(dir, 'cargo'), '#!/bin/sh\necho "$@" >> "$SHIM_LOG"\n');
  chmodSync(join(dir, 'cargo'), 0o755);
  return { dir, log, seen: () => (existsSync(log) ? readFileSync(log, 'utf8').split(/\r?\n/).filter(Boolean).map((l) => l.trim().replace(/-j \d+$/, '-j N')) : []) };
}

// A consumer whose Cargo.lock holds rg-used only, over a rapid-game origin with crates rg-used and rg-other.
function world(extra = []) {
  const subDir = tempDir('ps-sub-bare-');
  const subSrc = makeRepo(tempDir('ps-sub-src-'));
  const subBare = addOrigin(subSrc, join(subDir, 'sub.git')).split(String.fromCharCode(92)).join('/');
  for (const crate of ['rg-used', 'rg-other']) {
    mkdirSync(join(subSrc, 'rust', crate, 'src'), { recursive: true });
    writeFileSync(join(subSrc, 'rust', crate, 'Cargo.toml'), manifest(crate));
    writeFileSync(join(subSrc, 'rust', crate, 'src', 'lib.rs'), 'pub fn f() {}\n');
  }
  g(['add', '-A'], subSrc);
  g(['commit', '-m', 'crates'], subSrc);
  g(['push', 'origin', 'main'], subSrc);
  const root = makeRepo(tempDir('ps-consumer-'));
  const superDir = tempDir('ps-super-bare-');
  addOrigin(root, join(superDir, 'super.git'));
  writeFileSync(join(root, 'Cargo.toml'), '[workspace]\nmembers = []\n');
  writeFileSync(join(root, 'Cargo.lock'), LOCK);
  g(['add', '-A'], root);
  g(['commit', '-m', 'workspace'], root);
  g(['-c', 'protocol.file.allow=always', 'submodule', 'add', subBare, 'rapid-game'], root);
  g(['commit', '-m', 'add submodule'], root);
  g(['push', 'origin', 'main'], root);
  const sub = join(root, 'rapid-game');
  g(['checkout', 'main'], sub);
  for (const [k, v] of [['user.email', 'b@test'], ['user.name', 'B'], ['commit.gpgsign', 'false']]) g(['config', k, v], sub);
  mkdirSync(join(root, '.ai'), { recursive: true });
  writeFileSync(join(root, '.ai', 'config.yml'), config(extra));
  const shim = cargoShim();
  const was = { PATH: process.env.PATH, SHIM_LOG: process.env.SHIM_LOG };
  process.env.PATH = `${shim.dir}${process.platform === 'win32' ? ';' : ':'}${process.env.PATH}`;
  process.env.SHIM_LOG = shim.log;
  const done = () => {
    process.env.PATH = was.PATH;
    if (was.SHIM_LOG === undefined) delete process.env.SHIM_LOG; else process.env.SHIM_LOG = was.SHIM_LOG;
    [subDir, subSrc, root, superDir, shim.dir].forEach(cleanup);
  };
  return { root, sub, cfg: readBrokerConfig(root), shim, done };
}

// A framework commit touching `file`, pushed; returns its sha.
function land(w, file, text) {
  mkdirSync(dirname(join(w.sub, file)), { recursive: true });
  commitOnMain(w.sub, file, text, `change ${file}`);
  g(['push', 'origin', 'main'], w.sub);
  return g(['rev-parse', 'HEAD'], w.sub);
}

function queuePin(w, sha) {
  const { job, error } = buildPatchJob(w.cfg, { ticket: 'RG-T1', title: `pin ${sha.slice(0, 8)}`, pin: `rapid-game=${sha}`, 'no-patch': true, land: true, 'auto-pin': 'j-origin' }, '');
  assert.equal(error, undefined);
  writeJob(w.cfg, job);
  return job;
}

test('a pin whose delta is outside the consumer lock runs the build check only and says so in the commit', () => {
  const w = world();
  try {
    const sha = land(w, 'rust/rg-other/src/lib.rs', 'pub fn g() {}\n');
    const job = queuePin(w, sha);
    processOnce(w.cfg);
    const r = readResult(w.cfg, job.id);
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.deepEqual(w.shim.seen(), ['t --no-run -j N']);
    assert.match(r.pinScope, /no crate in this consumer's closure changed \(pin delta touches rg-other\)/);
    assert.match(g(['log', '-1', '--format=%B'], w.root), /Broker-Gate: .*no crate in this consumer's closure changed/);
    assert.equal(g(['rev-parse', 'HEAD:rapid-game'], w.root), sha);
  } finally { w.done(); }
});

test('a delta in a crate the consumer lock names runs the build check and the tests of the crates that depend on it, not the full verify', () => {
  const w = world();
  try {
    const sha = land(w, 'rust/rg-used/src/lib.rs', 'pub fn g() {}\n');
    const job = queuePin(w, sha);
    processOnce(w.cfg);
    const r = readResult(w.cfg, job.id);
    assert.equal(r.status, 'landed', JSON.stringify(r));
    assert.deepEqual(w.shim.seen(), ['t --no-run -j N', 't -p app --no-fail-fast -j N']);
    assert.match(r.pinScope, /pin delta touches rg-used; build check plus tests of app/);
  } finally { w.done(); }
});

test('a workspace-level file or a docs-only delta runs the build check alone', () => {
  const w = world();
  try {
    const sha = land(w, 'rust/Cargo.lock', 'version = 3\n');
    const wide = queuePin(w, sha);
    processOnce(w.cfg);
    assert.deepEqual(w.shim.seen(), ['t --no-run -j N']);
    assert.match(readResult(w.cfg, wide.id).pinScope, /a workspace-level file changed; build check only/);
    const docs = land(w, 'docs/notes.md', 'notes\n');
    const job = queuePin(w, docs);
    processOnce(w.cfg);
    assert.match(readResult(w.cfg, job.id).pinScope, /pin delta touches no crate/);
    assert.deepEqual(w.shim.seen().slice(1), ['t --no-run -j N']);
  } finally { w.done(); }
});

test('pin_test_args from the config is appended to the dependents test run', () => {
  const w = world(['  pin_test_args: ["-P", "pin"]']);
  try {
    const sha = land(w, 'rust/rg-used/src/lib.rs', 'pub fn g() {}\n');
    queuePin(w, sha);
    processOnce(w.cfg);
    assert.deepEqual(w.shim.seen(), ['t --no-run -j N', 't -p app -P pin --no-fail-fast -j N']);
  } finally { w.done(); }
});

test('readLock and dependentsOf: local packages are those without a source, dependents come through the graph', () => {
  const dir = tempDir('ps-lock-');
  const top = ['[[package]]', 'name = "top"', 'version = "0.1.0"', 'dependencies = [', ' "app",', ' "serde 1.0.0",', ']', ''].join('\n');
  writeFileSync(join(dir, 'Cargo.lock'), `${LOCK}\n${top}`);
  const lock = readLock(join(dir, 'Cargo.lock'));
  assert.deepEqual([...lock].filter(([, v]) => v.local).map(([k]) => k), ['rg-used', 'app', 'top']);
  assert.deepEqual([...dependentsOf(lock, ['rg-used'])].sort(), ['app', 'rg-used', 'top']);
  assert.deepEqual([...dependentsOf(lock, ['serde'])].sort(), ['serde', 'top']);
  assert.equal(readLock(join(dir, 'missing.lock')), null);
});

test('buildOnly keeps build commands, adds --no-run to test commands before the separator, drops the rest', () => {
  assert.deepEqual(
    buildOnly(['cargo t', 'cargo test -p x -- --nocapture', 'cargo check', 'npm run lint', 'cd rust && cargo t --no-run']),
    ['cargo t --no-run', 'cargo test --no-run -p x -- --nocapture', 'cargo check', 'cd rust && cargo t --no-run'],
  );
});

test('a queued auto-pin that a newer pin of the same submodule covers is dropped', () => {
  const w = world();
  try {
    const first = land(w, 'rust/rg-other/src/lib.rs', 'pub fn a() {}\n');
    const second = land(w, 'rust/rg-other/src/lib.rs', 'pub fn b() {}\n');
    const j1 = queuePin(w, first);
    const j2 = queuePin(w, second);
    assert.deepEqual(dropSuperseded(w.cfg), [{ id: j1.id, by: j2.id }]);
    assert.deepEqual(listQueue(w.cfg).map((j) => j.id), [j2.id]);
    const gone = readResult(w.cfg, j1.id);
    assert.equal(gone.status, 'superseded');
    assert.match(gone.message, new RegExp(j2.id));
    assert.deepEqual(dropSuperseded(w.cfg), [], 'the newest pin stays');
  } finally { w.done(); }
});

test('control: the older sha submitted after the newer one does not drop the newer pin', () => {
  const w = world();
  try {
    const first = land(w, 'rust/rg-other/src/lib.rs', 'pub fn a() {}\n');
    const second = land(w, 'rust/rg-other/src/lib.rs', 'pub fn b() {}\n');
    queuePin(w, second);
    queuePin(w, first);
    assert.deepEqual(dropSuperseded(w.cfg).map((d) => d.by), [], 'neither is covered by a later descendant');
    assert.equal(listQueue(w.cfg).length, 2);
  } finally { w.done(); }
});
