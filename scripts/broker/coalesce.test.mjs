// coalesce.test.mjs — with `runner: nextest`, a job's per-target cargo tests run as one nextest
// invocation (KIT-T483).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, join } from 'node:path';
import { coalesce } from './coalesce.mjs';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const cmds = (list) => coalesce(list).map((s) => s.cmd);

test('per-target cargo tests of one package merge into one nextest run, in first-member position', () => {
  const out = coalesce([
    'cargo t -p game --lib',
    'cargo clippy -p game',
    'cargo t -p game --test a -j 3',
    'cargo test -p game --no-fail-fast --test b --test a',
  ]);
  assert.deepEqual(out.map((s) => s.cmd), ['cargo nextest run --no-fail-fast -p game --lib --test a --test b', 'cargo clippy -p game']);
  assert.deepEqual(out[0].from, ['cargo t -p game --lib', 'cargo t -p game --test a -j 3', 'cargo test -p game --no-fail-fast --test b --test a']);
  assert.equal(out[1].from, null);
});

test('targets of several packages merge into one nextest run naming every package', () => {
  const out = coalesce(['cargo test --offline -p game --lib --test lanes', 'cargo check --workspace', 'cargo test --offline -p ui --lib', 'cargo test --offline -p game --test venue']);
  assert.deepEqual(out.map((s) => s.cmd), ['cargo nextest run --no-fail-fast --offline -p game -p ui --lib --test lanes --test venue', 'cargo check --workspace']);
  assert.equal(out[0].from.length, 3);
});

test('negative: name filters, unfiltered runs, workspace-wide runs, other flags and lone targets keep their own run', () => {
  assert.deepEqual(cmds(['cargo t -p game --test a -- held_steer', 'cargo t -p game --test b -- --nocapture']), ['cargo t -p game --test a -- held_steer', 'cargo t -p game --test b -- --nocapture']);
  assert.deepEqual(cmds(['cargo test -p game', 'cargo test -p game']), ['cargo test -p game', 'cargo test -p game'], 'an unfiltered run includes doctests nextest skips');
  assert.deepEqual(cmds(['cargo t -p game --test a', 'cargo t --test b']), ['cargo t -p game --test a', 'cargo t --test b'], 'a workspace-wide run never takes a package list');
  assert.deepEqual(cmds(['cargo t -p game --test a', 'cargo t -p game --release --test b']), ['cargo t -p game --test a', 'cargo t -p game --release --test b']);
  assert.deepEqual(cmds(['cargo t -p game --test a', 'echo hi']), ['cargo t -p game --test a', 'echo hi']);
});

// A fake `cargo` first on PATH records each invocation, so the job's real command line is visible.
function fakeCargo() {
  const bin = tempDir('fake-cargo-');
  const log = join(bin, 'calls.log');
  const node = `node -e "require('fs').appendFileSync(process.argv[1], process.argv.slice(2).join(' ') + '\\n')"`;
  if (process.platform === 'win32') writeFileSync(join(bin, 'cargo.cmd'), `@${node} "${log}" %*\r\n`);
  else { writeFileSync(join(bin, 'cargo'), `#!/bin/sh\n${node} "${log}" "$@"\n`, { mode: 0o755 }); }
  return { bin, calls: () => (existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').map((l) => l.trim()) : []), done: () => cleanup(bin) };
}

for (const runner of ['nextest', 'cargo']) {
  test(`a job under runner ${runner} runs ${runner === 'nextest' ? 'one nextest invocation' : 'each command as written (negative control)'}`, () => {
    const s = fixture();
    const cargo = fakeCargo();
    const path = process.env.PATH;
    process.env.PATH = cargo.bin + delimiter + path;
    try {
      s.cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }], runner, parallelism: { jobs: 2 } });
      const { job } = buildPatchJob(s.cfg, { ticket: 'T-1' }, envelope(['beta', 'BETA']));
      writeJob(s.cfg, { ...job, commands: ['cargo t -p app --lib', 'cargo t -p app --test a'] });
      processOnce(s.cfg);
      const r = readResult(s.cfg, job.id);
      assert.equal(r.status, 'passed', JSON.stringify(r.commands));
      if (runner === 'nextest') {
        assert.deepEqual(cargo.calls(), ['nextest run --no-fail-fast -p app --lib --test a -j 2']);
        assert.deepEqual(r.commands[0].coalesced, ['cargo t -p app --lib', 'cargo t -p app --test a']);
      } else {
        assert.deepEqual(cargo.calls(), ['t -p app --lib --no-fail-fast -j 2', 't -p app --test a --no-fail-fast -j 2']);
      }
    } finally { process.env.PATH = path; cargo.done(); s.done(); }
  });
}

test('a cd prefix leads the merged command and never merges across workspaces', () => {
  const out = coalesce(['cd rust && cargo t -p a --lib', 'cd rust && cargo t -p b --test x', 'cargo t -p c --lib', 'cargo t -p d --lib']);
  assert.deepEqual(out.map((s) => s.cmd), ['cd rust && cargo nextest run --no-fail-fast -p a -p b --lib --test x', 'cargo nextest run --no-fail-fast -p c -p d --lib']);
});
