#!/usr/bin/env node
// config-edit.test.mjs — `t config get|set` (KIT-T836): one key of .ai/config.yml changes, every other
// byte stays, and a broker key the reader does not take (or takes in another shape) is refused with the file untouched.
// Run: node scripts/config-edit.test.mjs

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getConfigKey, setConfigKey } from './config-edit.mjs';
import { BROKER_KEYS } from './broker/config-schema.mjs';
import { readBrokerConfig } from './broker/config.mjs';

let passed = 0;
const ok = (name, fn) => { fn(); passed++; console.log(`  ok    ${name}`); };
const dirs = [];

const BASE = `# project config
classifications:
  bug: { routes_to: tickets }

broker:
  land_gate: affected   # gate kind
  parallelism:
    jobs: auto
  affected:
    check: "cargo check --workspace"
    test: "cargo test"
  suite:
    - cargo test -p a
    - cargo test -p b
  repos:
    - { name: app, path: ., main: main, remote: origin }

# trailing section
deck:
  host: steamdeck
`;

function project(text = BASE) {
  const root = mkdtempSync(join(tmpdir(), 'kit-config-'));
  dirs.push(root);
  mkdirSync(join(root, '.ai'));
  writeFileSync(join(root, '.ai', 'config.yml'), text);
  return root;
}
const read = (root) => readFileSync(join(root, '.ai', 'config.yml'), 'utf8');
const lineDiff = (a, b) => {
  const x = a.split('\n');
  const y = b.split('\n');
  return { removed: x.filter((l) => !y.includes(l)), added: y.filter((l) => !x.includes(l)) };
};

try {
  ok('sets a missing nested key at the end of its parent block and the broker reader sees it', () => {
    const root = project();
    const r = setConfigKey(root, 'broker.affected.conformance', ['cargo t -p dirt-empire --test framework_conformance']);
    assert.equal(r.changed, true);
    assert.deepEqual(lineDiff(BASE, read(root)), { removed: [], added: ['    conformance: "cargo t -p dirt-empire --test framework_conformance"'] });
    assert.equal(readBrokerConfig(root).affected.conformance, 'cargo t -p dirt-empire --test framework_conformance');
    const lines = read(root).split('\n');
    assert.ok(lines.indexOf('    conformance: "cargo t -p dirt-empire --test framework_conformance"') === lines.indexOf('    test: "cargo test"') + 1);
  });

  ok('replaces an existing scalar in place, keeping its trailing comment', () => {
    const root = project();
    const r = setConfigKey(root, 'broker.land_gate', ['full']);
    assert.equal(r.previous, 'affected');
    assert.deepEqual(lineDiff(BASE, read(root)), { removed: ['  land_gate: affected   # gate kind'], added: ['  land_gate: full   # gate kind'] });
    assert.equal(readBrokerConfig(root).landGate, 'full');
  });

  ok('replaces a block list with a flow list of the given words; a second set is a no-op', () => {
    const root = project();
    setConfigKey(root, 'broker.suite', ['cargo test -p c', 'cargo clippy']);
    assert.match(read(root), /  suite: \["cargo test -p c", "cargo clippy"\]\n  repos:/);
    assert.deepEqual(readBrokerConfig(root).suite, ['cargo test -p c', 'cargo clippy']);
    assert.equal(setConfigKey(root, 'broker.suite', ['cargo test -p c', 'cargo clippy']).changed, false);
  });

  ok('creates the missing parent blocks, typed bools and numbers unquoted', () => {
    const root = project('ids:\n  key: "X"\n');
    setConfigKey(root, 'broker.affected.dependents', ['false']);
    setConfigKey(root, 'broker.batch', ['4']);
    assert.equal(read(root), 'ids:\n  key: "X"\nbroker:\n  affected:\n    dependents: false\n  batch: 4\n');
    const cfg = readBrokerConfig(root);
    assert.deepEqual([cfg.affected.dependents, cfg.batch], [false, 4]);
  });

  ok('a non-broker key is written untyped-checked and read back by get', () => {
    const root = project();
    setConfigKey(root, 'deck.host', ['deck2']);
    assert.equal(getConfigKey(root, 'deck.host').value, 'deck2');
    assert.equal(getConfigKey(root, 'deck.port').value, undefined);
    assert.equal(getConfigKey(root, 'broker.affected.check').value, 'cargo check --workspace');
  });

  ok('CRLF files keep their line endings', () => {
    const root = project(BASE.replace(/\n/g, '\r\n'));
    setConfigKey(root, 'broker.runner', ['nextest']);
    assert.ok(!/[^\r]\n/.test(read(root)));
    assert.equal(readBrokerConfig(root).runner, 'nextest');
  });

  ok('negative: unknown broker key, bad enum, bad bool, bad clock, bad count leave the file untouched', () => {
    const root = project();
    for (const [key, words, re] of [
      ['broker.affected.conformence', ['x'], /not a key the broker reads/],
      ['broker.land_gate', ['sometimes'], /must be one of affected \| full/],
      ['broker.check_tree', ['yes'], /true or false/],
      ['broker.nightly_at', ['25:00'], /HH:MM/],
      ['broker.batch', ['0'], />= 1/],
      ['broker.batch', ['1.5'], /integer/],
      ['broker.repos', ['x'], /not a key the broker reads/],
      ['broker.affected.test', ['a', 'b'], /takes one value/],
      ['broker.land_gate.sub', ['x'], /inline value|not a key/],
      ['broker.affected', ['x'], /not a key the broker reads/],
    ]) {
      assert.throws(() => setConfigKey(root, key, words), re, `${key} ${words}`);
    }
    assert.equal(read(root), BASE);
  });

  ok('negative: setting a key that holds a map or an inline value is refused', () => {
    const root = project('x:\n  parallelism: { jobs: auto }\n  m:\n    a: 1\n');
    assert.throws(() => setConfigKey(root, 'x.m', ['1']), /is a map/);
    assert.throws(() => setConfigKey(root, 'x.parallelism.k', ['1']), /inline value/);
  });

  ok('negative: no config.yml, no key, no value', () => {
    const root = mkdtempSync(join(tmpdir(), 'kit-config-'));
    dirs.push(root);
    assert.throws(() => setConfigKey(root, 'broker.batch', ['2']), /no .*config\.yml to edit/);
    const have = project();
    assert.throws(() => setConfigKey(have, '', ['2']), /dotted key is required/);
    assert.throws(() => setConfigKey(have, 'deck.host', []), /value is required/);
  });

  ok('every settable key is one the broker reader reads (schema is not ahead of the reader)', () => {
    const reader = ['config.mjs', 'pipeline-config.mjs'].map((f) => readFileSync(join(import.meta.dirname, 'broker', f), 'utf8')).join('\n');
    for (const key of BROKER_KEYS) {
      const leaf = key.split('.').pop();
      assert.ok(reader.includes(leaf), `${key}: the reader never names ${leaf}`);
    }
  });

  ok('the CLI verb prints the change, get prints the value, a bad key exits 1, no args exits 2', () => {
    const root = project();
    const run = (...args) => spawnSync(process.execPath, [join(import.meta.dirname, 't.mjs'), 'config', ...args, '--root', root], { encoding: 'utf8' });
    const set = run('set', 'broker.affected.conformance', 'cargo t -p g --test conformance');
    assert.equal(set.status, 0, set.stderr);
    assert.equal(set.stdout, 'config: broker.affected.conformance: (unset) -> cargo t -p g --test conformance\n');
    assert.equal(run('get', 'broker.affected.conformance').stdout, 'config: broker.affected.conformance: cargo t -p g --test conformance\n');
    assert.equal(run('set', 'broker.nope', '1').status, 1);
    assert.equal(run().status, 2);
  });
} finally {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}
console.log(`\n${passed} passed`);
