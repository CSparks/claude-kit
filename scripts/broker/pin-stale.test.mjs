// pin-stale.test.mjs — a landing --pin only moves the gitlink forward (KIT-T515). A job queued with
// an old pin, behind a newer pin that landed first, is refused with `stale` naming both shas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { g } from './patchkit.mjs';
import { PASS, setup } from './subkit.mjs';

const frameworkCommit = (t, file) => t.run({ repo: 'rapid-game', ticket: 'ST-T1', title: `fw ${file}`, land: true, 'no-pin': true }, `*** write ${file}\nx\n`).r.landed.sha;

const queueOnly = (t, flags, env, commands = [PASS]) => {
  const out = buildPatchJob(t.cfg, flags, env);
  assert.ok(out.job, JSON.stringify(out));
  return { ...out.job, commands };
};

const runQueued = (t, job) => {
  writeJob(t.cfg, job);
  processOnce(t.cfg);
  return readResult(t.cfg, job.id);
};

test('a queued --pin job whose pin is behind a newer landed pin is refused and moves nothing', () => {
  const t = setup();
  try {
    const old = frameworkCommit(t, 'a.txt');
    const newer = frameworkCommit(t, 'b.txt');
    const stale = queueOnly(t, { ticket: 'ST-T2', title: 'old pin', land: true, pin: `rapid-game=${old}` }, '*** write old.txt\no\n');
    const landed = t.run({ ticket: 'ST-T3', title: 'new pin', land: true, pin: `rapid-game=${newer}` }, '*** write new.txt\nn\n').r;
    assert.equal(landed.status, 'landed', JSON.stringify(landed));
    const head = g(['rev-parse', 'HEAD'], t.root);

    const r = runQueued(t, stale);
    assert.equal(r.status, 'stale', JSON.stringify(r));
    assert.equal(r.phase, 'pin');
    assert.ok(r.message.includes(old.slice(0, 10)) && r.message.includes(newer.slice(0, 10)), r.message);
    assert.equal(g(['rev-parse', 'HEAD'], t.root), head, 'no commit');
    assert.equal(g(['rev-parse', 'HEAD:rapid-game'], t.root), newer, 'gitlink stays at the newer pin');
    assert.equal(g(['--git-dir', t.superBare, 'rev-parse', 'main'], t.root), head);
    assert.equal(g(['rev-parse', 'HEAD'], t.sub), newer, 'submodule checkout restored');
  } finally { t.done(); }
});

test('negative control: a pin that descends from the recorded gitlink, or equals it, still lands', () => {
  const t = setup();
  try {
    const first = frameworkCommit(t, 'a.txt');
    const second = frameworkCommit(t, 'b.txt');
    const a = t.run({ ticket: 'ST-T2', title: 'first', land: true, pin: `rapid-game=${first}` }, '*** write one.txt\n1\n').r;
    assert.equal(a.status, 'landed', JSON.stringify(a));
    const b = t.run({ ticket: 'ST-T3', title: 'second', land: true, pin: `rapid-game=${second}` }, '*** write two.txt\n2\n').r;
    assert.equal(b.status, 'landed', JSON.stringify(b));
    assert.equal(g(['rev-parse', 'HEAD:rapid-game'], t.root), second);
    const same = t.run({ ticket: 'ST-T4', title: 'same', land: true, pin: `rapid-game=${second}` }, '*** write three.txt\n3\n').r;
    assert.equal(same.status, 'landed', JSON.stringify(same));
  } finally { t.done(); }
});

test('a check-only job may build with an older pin', () => {
  const t = setup();
  try {
    const old = frameworkCommit(t, 'a.txt');
    const newer = frameworkCommit(t, 'b.txt');
    assert.equal(t.run({ ticket: 'ST-T3', title: 'new pin', land: true, pin: `rapid-game=${newer}` }, '*** write new.txt\nn\n').r.status, 'landed');
    assert.equal(t.run({ pin: `rapid-game=${old}` }, '*** write x.txt\nx\n').r.status, 'passed');
  } finally { t.done(); }
});

test('a gitlink that advances while the job runs is caught again at land time', () => {
  const t = setup();
  try {
    const old = frameworkCommit(t, 'a.txt');
    const newer = frameworkCommit(t, 'b.txt');
    const bump = join(t.root, 'bump.cjs');
    const script = [
      "const { execFileSync: x } = require('child_process');",
      "const o = { encoding: 'utf8' };",
      `x('git', ['update-index', '--cacheinfo', '160000,${newer},rapid-game'], o);`,
      "const tree = x('git', ['write-tree'], o).trim();",
      "const c = x('git', ['commit-tree', tree, '-p', 'HEAD', '-m', 'hand pin'], o).trim();",
      "x('git', ['update-ref', 'HEAD', c], o);",
    ].join('\n');
    writeFileSync(bump, script);
    const r = t.run({ ticket: 'ST-T2', title: 'old pin', land: true, pin: `rapid-game=${old}` }, '*** write old.txt\no\n', [`node ${bump.replace(/\\/g, '/')}`]).r;
    assert.equal(r.status, 'stale', JSON.stringify(r));
    assert.match(r.message, new RegExp(newer.slice(0, 10)));
    assert.equal(g(['rev-list', '--count', 'HEAD'], t.root), '3', 'init, add submodule, hand pin; the job committed nothing');
  } finally { t.done(); }
});
