// baseline.test.mjs — the attribution baseline is cached by pre-patch tree state and command
// (KIT-T472): a revision that fails the same way on the same HEAD reuses the base log instead of
// restoring the tree and re-running.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { commitOnMain, fixture } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

// Always fails `a_foreign`; counts the runs made on the base tree (marker.txt absent).
const foreignSuite = (countFile) => {
  const code = [
    `const fs=require('fs');if(!fs.existsSync('marker.txt'))fs.appendFileSync('${countFile}','x');`,
    `console.log('test a_foreign ... FAILED');console.log('---- a_foreign stdout ----');console.log('boom');process.exit(1)`,
  ].join('');
  return `node -e "${code.replaceAll('"', '\\"')}"`;
};

const setup = () => {
  const s = fixture();
  const dir = tempDir('base-count-');
  const file = join(dir, 'runs').replace(/\\/g, '/');
  const runs = () => (existsSync(file) ? readFileSync(file, 'utf8').length : 0);
  const submit = (marker) => {
    const { job } = buildPatchJob(s.cfg, { ticket: 'T-1' }, `*** write marker.txt\n${marker}\n`);
    writeJob(s.cfg, { ...job, commands: [foreignSuite(file)] });
    processOnce(s.cfg);
    return readResult(s.cfg, job.id);
  };
  return { s, runs, submit, done: () => { cleanup(dir); s.done(); } };
};

test('a second revision failing the same test on the same HEAD reuses the base run', () => {
  const t = setup();
  try {
    const first = t.submit('one');
    assert.equal(first.status, 'passed', JSON.stringify(first.commands[0].logTail));
    assert.deepEqual(first.foreign.map((f) => f.test), ['a_foreign']);
    assert.equal(t.runs(), 1);
    const second = t.submit('two');
    assert.equal(second.status, 'passed');
    assert.deepEqual(second.foreign.map((f) => f.test), ['a_foreign'], 'still attributed foreign from the cached base log');
    assert.equal(t.runs(), 1, 'no second base run');
  } finally { t.done(); }
});

test('negative: a HEAD that moved re-runs the base', () => {
  const t = setup();
  try {
    t.submit('one');
    commitOnMain(t.s.root, 'other.txt', 'moved\n', 'unrelated landing');
    const second = t.submit('two');
    assert.equal(second.status, 'passed');
    assert.equal(t.runs(), 2);
  } finally { t.done(); }
});
