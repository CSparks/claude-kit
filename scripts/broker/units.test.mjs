// units.test.mjs — the broker's pure pieces: config parsing, command composition, the lock, and
// the job/result store. No git, no spawned builds — fast, deterministic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseYaml, readBrokerConfig, normalizeBroker, repoByName, brokerPaths } from './config.mjs';
import { composeCommand } from './run.mjs';
import { acquireLock, releaseLock } from './lock.mjs';
import { writeJob, listQueue, removeJob, writeResult, readResult, STATUS } from './result.mjs';
import { tempDir, cleanup } from './testkit.mjs';

test('parseYaml: nested maps, scalar + flow-map lists, inline flow', () => {
  const doc = parseYaml(`broker:
  target_dir: /shared/target
  parallelism:
    jobs: 4
  verify_default:
    - cargo test --no-fail-fast
    - cargo clippy
  repos:
    - { name: app, path: ., main: main, remote: origin }
    - { name: sub, path: rapid-game, main: main, remote: origin, submodule: true, pin_in: . }
`);
  assert.equal(doc.broker.target_dir, '/shared/target');
  assert.equal(doc.broker.parallelism.jobs, 4);
  assert.deepEqual(doc.broker.verify_default, ['cargo test --no-fail-fast', 'cargo clippy']);
  assert.equal(doc.broker.repos.length, 2);
  assert.equal(doc.broker.repos[1].submodule, true);
  assert.equal(doc.broker.repos[1].path, 'rapid-game');
});

test('readBrokerConfig: defaults + repo lookup', () => {
  const dir = tempDir();
  try {
    mkdirSync(join(dir, '.ai'), { recursive: true });
    writeFileSync(join(dir, '.ai', 'config.yml'), `broker:
  repos:
    - { name: app, path: ., main: trunk, remote: upstream }
`);
    const cfg = readBrokerConfig(dir);
    assert.equal(cfg.jobs, 3); // default
    assert.deepEqual(cfg.verifyDefault, ['cargo test --no-fail-fast']); // default
    assert.equal(cfg.targetDir, join(dir, 'target')); // default under root
    const app = repoByName(cfg, 'app');
    assert.equal(app.main, 'trunk');
    assert.equal(app.remote, 'upstream');
    assert.equal(app.submodule, false);
    assert.equal(brokerPaths(cfg).queue, join(dir, 'target', 'broker', 'queue'));
  } finally {
    cleanup(dir);
  }
});

test('composeCommand: cargo test gets --no-fail-fast + -j, idempotently', () => {
  assert.equal(composeCommand('cargo test -p foo --lib', { jobs: 3 }), 'cargo test -p foo --lib --no-fail-fast -j 3');
  assert.equal(composeCommand('cargo build', { jobs: 3 }), 'cargo build -j 3'); // no --no-fail-fast for build
  assert.equal(composeCommand('cargo test --no-fail-fast -j 2', { jobs: 3 }), 'cargo test --no-fail-fast -j 2'); // untouched
  assert.equal(composeCommand('echo hi', { jobs: 3 }), 'echo hi'); // non-cargo passthrough
});

test('lock: one holder, reclaim on release', () => {
  const dir = tempDir();
  try {
    const cfg = normalizeBroker(dir, { repos: [] });
    const a = acquireLock(cfg);
    assert.equal(a.ok, true);
    const b = acquireLock(cfg);
    assert.equal(b.ok, false);
    assert.equal(b.holder.pid, process.pid);
    releaseLock(cfg);
    assert.equal(acquireLock(cfg).ok, true);
    releaseLock(cfg);
  } finally {
    cleanup(dir);
  }
});

test('result store: job queue in order, remove, result round-trip', () => {
  const dir = tempDir();
  try {
    const cfg = normalizeBroker(dir, { repos: [] });
    const j1 = writeJob(cfg, { id: 'j-a', repo: 'app', branch: 'lane/a' });
    const j2 = writeJob(cfg, { id: 'j-b', repo: 'app', branch: 'lane/b' });
    assert.deepEqual(listQueue(cfg).map((j) => j.id), ['j-a', 'j-b']);
    assert.ok(j1.submittedAt && j2.submittedAt);
    removeJob(cfg, 'j-a');
    assert.deepEqual(listQueue(cfg).map((j) => j.id), ['j-b']);
    writeResult(cfg, { id: 'j-b', status: STATUS.PASSED });
    assert.equal(readResult(cfg, 'j-b').status, STATUS.PASSED);
    assert.equal(readResult(cfg, 'nope'), null);
  } finally {
    cleanup(dir);
  }
});
