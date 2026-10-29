// landgate-reuse.test.mjs — a `--land` that reuses a passed check-only run still compiles every target
// under `land_gate: affected` (KIT-T677): the check-only run's own commands may build only what they name.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const counter = (dir, name) => {
  const file = join(dir, name).replace(/\\/g, '/');
  return { cmd: `node -e "require('fs').appendFileSync('${file}','x')"`, runs: () => (existsSync(file) ? readFileSync(file, 'utf8').length : 0) };
};

const submit = (s, flags, cmd) => {
  const { job } = buildPatchJob(s.cfg, flags, envelope(['beta', 'BETA']));
  writeJob(s.cfg, { ...job, commands: [cmd] });
  processOnce(s.cfg);
  return readResult(s.cfg, job.id);
};

function run(landGate) {
  const s = fixture();
  const dir = tempDir('landgate-reuse-');
  const test = counter(dir, 'test');
  const check = counter(dir, 'check');
  s.cfg.landGate = landGate;
  s.cfg.affected = { check: check.cmd, test: 'cargo test', match: 'word', mandatory: false };
  const first = submit(s, { ticket: 'T-1' }, test.cmd);
  const land = submit(s, { ticket: 'T-1', title: 'beta', land: true }, test.cmd);
  return { s, first, land, test, check, done: () => { s.done(); cleanup(dir); } };
}

test('under the affected gate a land reusing a check run compiles every target once', () => {
  const r = run('affected');
  try {
    assert.equal(r.first.status, 'passed');
    assert.equal(r.land.status, 'landed', JSON.stringify(r.land));
    assert.equal(r.land.reusedFrom, r.first.id, 'the scoped command was reused');
    assert.equal(r.test.runs(), 1, 'the scoped command did not run again');
    assert.equal(r.check.runs(), 1, 'the all-targets check ran on the landing');
    assert.deepEqual(r.land.commands.map((c) => Boolean(c.reusedFrom)), [true, false]);
  } finally { r.done(); }
});

test('negative control: with the full gate the reused land runs nothing more', () => {
  const r = run('full');
  try {
    assert.equal(r.land.status, 'landed');
    assert.equal(r.check.runs(), 0);
    assert.equal(r.test.runs(), 1);
  } finally { r.done(); }
});
