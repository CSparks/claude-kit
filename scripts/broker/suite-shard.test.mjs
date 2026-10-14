// suite-shard.test.mjs — with suite_partitions N each suite run covers one rotating partition, so
// a forced run holds the writer for 1/N of the suite (KIT-T482 item 6).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { ensureDirs } from './result.mjs';
import { runSuite, suiteLine, suiteState } from './suite.mjs';
import { shardCommands } from './suite-shard.mjs';
import { fixture, g } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

test('shardCommands: nextest gets --partition count:k/n, other commands take turns', () => {
  const suite = ['cargo nextest run --workspace', 'cargo run --release --bin probe', 'npm run lint'];
  assert.deepEqual(shardCommands(suite, 1, 2), ['cargo nextest run --workspace --partition count:1/2', 'cargo run --release --bin probe']);
  assert.deepEqual(shardCommands(suite, 2, 2), ['cargo nextest run --workspace --partition count:2/2', 'npm run lint']);
  assert.deepEqual(shardCommands(suite, 1, 1), suite, 'one partition is the whole suite, unchanged');
});

// A fake `cargo` first on PATH records each suite invocation.
function fakeCargo() {
  const bin = tempDir('fake-cargo-');
  const log = join(bin, 'calls.log');
  const node = `node -e "require('fs').appendFileSync(process.argv[1], process.argv.slice(2).join(' ') + '\\n')"`;
  if (process.platform === 'win32') writeFileSync(join(bin, 'cargo.cmd'), `@${node} "${log}" %*\r\n`);
  else writeFileSync(join(bin, 'cargo'), `#!/bin/sh\n${node} "${log}" "$@"\n`, { mode: 0o755 });
  return { bin, calls: () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map((l) => l.trim()) : []), done: () => cleanup(bin) };
}

function runs(partitions, count) {
  const s = fixture();
  const cargo = fakeCargo();
  const path = process.env.PATH;
  process.env.PATH = cargo.bin + delimiter + path;
  try {
    s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }], land_gate: 'affected', suite: ['cargo nextest run --workspace'], suite_partitions: partitions, parallelism: { jobs: 2 } });
    ensureDirs(s.cfg);
    for (let i = 0; i < count; i++) {
      g(['commit', '--allow-empty', '-qm', `landing ${i}`], s.root);
      const r = runSuite(s.cfg, { fileBug: () => assert.fail('no bug expected') });
      assert.equal(r.status, 'passed');
    }
    return { calls: cargo.calls(), state: suiteState(s.cfg), line: suiteLine(s.cfg) };
  } finally { process.env.PATH = path; cargo.done(); s.done(); }
}

test('three partitions rotate 1/3, 2/3, 3/3 and back to 1/3, each green recorded per partition', () => {
  const r = runs(3, 4);
  assert.deepEqual(r.calls.map((c) => c.match(/count:\d\/\d/)[0]), ['count:1/3', 'count:2/3', 'count:3/3', 'count:1/3']);
  assert.deepEqual(Object.keys(r.state.greens).sort(), ['1', '2', '3']);
  assert.match(r.line, /partition 2\/3 next/);
});

test('negative: one partition runs the whole suite with no --partition flag', () => {
  const r = runs(1, 2);
  assert.deepEqual(r.calls, ['nextest run --workspace -j 2', 'nextest run --workspace -j 2']);
  assert.doesNotMatch(r.line, /partition/);
});
