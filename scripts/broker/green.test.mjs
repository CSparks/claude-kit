// green.test.mjs — a `--land` of a patch whose check-only run passed on the same tree lands on
// that run's evidence instead of building and testing again (KIT-T472).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, envelope, fixture, g } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

// A command that counts its own runs in a file outside the tree.
const counter = () => {
  const dir = tempDir('green-count-');
  const file = join(dir, 'runs').replace(/\\/g, '/');
  return { cmd: `node -e "require('fs').appendFileSync('${file}','x')"`, runs: () => (existsSync(file) ? readFileSync(file, 'utf8').length : 0), done: () => cleanup(dir) };
};

const submitJob = (s, flags, cmd) => {
  const { job } = buildPatchJob(s.cfg, flags, envelope(['beta', 'BETA']));
  writeJob(s.cfg, { ...job, commands: [cmd] });
  processOnce(s.cfg);
  return readResult(s.cfg, job.id);
};

test('a land after a passed check of the same tree and commands reuses the check run', () => {
  const s = fixture();
  const c = counter();
  try {
    const check = submitJob(s, { ticket: 'T-1' }, c.cmd);
    assert.equal(check.status, 'passed');
    assert.equal(c.runs(), 1);
    const land = submitJob(s, { ticket: 'T-1', title: 'beta', land: true }, c.cmd);
    assert.equal(land.status, 'landed', JSON.stringify(land));
    assert.equal(c.runs(), 1, 'the land did not run the command again');
    assert.equal(land.reusedFrom, check.id);
    assert.equal(land.commands[0].reusedFrom, check.id);
    assert.equal(land.commands[0].exit, 0);
    assert.match(readFileSync(join(s.root, 'src.txt'), 'utf8'), /BETA/);
  } finally { c.done(); s.done(); }
});

test('negative: a HEAD that moved since the check, or a different command, runs the gate again', () => {
  const s = fixture();
  const c = counter();
  try {
    submitJob(s, { ticket: 'T-1' }, c.cmd);
    commitOnMain(s.root, 'other.txt', 'moved\n', 'unrelated landing');
    const moved = submitJob(s, { ticket: 'T-1', land: true }, c.cmd);
    assert.equal(moved.status, 'landed');
    assert.equal(moved.reusedFrom, null);
    assert.equal(c.runs(), 2, 'HEAD moved: the land re-ran');

    const before = g(['rev-parse', 'HEAD'], s.root);
    const { job } = buildPatchJob(s.cfg, { ticket: 'T-2' }, envelope(['gamma', 'GAMMA']));
    writeJob(s.cfg, { ...job, commands: [c.cmd] });
    processOnce(s.cfg);
    const other = buildPatchJob(s.cfg, { ticket: 'T-2', land: true }, envelope(['gamma', 'GAMMA'])).job;
    writeJob(s.cfg, { ...other, commands: [`${c.cmd} && node -e "0"`] });
    processOnce(s.cfg);
    const r = readResult(s.cfg, other.id);
    assert.equal(r.status, 'landed');
    assert.equal(r.reusedFrom, null);
    assert.equal(c.runs(), 4, 'a different command re-ran');
    assert.notEqual(g(['rev-parse', 'HEAD'], s.root), before);
  } finally { c.done(); s.done(); }
});

test('negative: a failed check is never reused', () => {
  const s = fixture();
  const c = counter();
  try {
    const fail = `${c.cmd} && node -e "process.exit(1)"`;
    assert.equal(submitJob(s, { ticket: 'T-1' }, fail).status, 'failed');
    assert.equal(submitJob(s, { ticket: 'T-1', land: true }, fail).status, 'failed');
    assert.equal(c.runs(), 2);
  } finally { c.done(); s.done(); }
});
