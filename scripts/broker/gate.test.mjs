// gate.test.mjs — the gate phase (KIT-T276 L3): a patch is held to the kit's pre-write checks
// before anything touches the tree.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture, snapshot } from './patchkit.mjs';

const longFile = (n) => Array.from({ length: n }, (_, i) => `fn f${i}() {}`).join('\n');

test('a patch leaving a file over the hard length limit stops at gate; the tree is untouched', () => {
  const s = fixture();
  try {
    const { job } = buildPatchJob(s.cfg, {}, `*** write big.rs\n${longFile(700)}\n`);
    writeJob(s.cfg, job);
    const before = snapshot(s.root);
    processOnce(s.cfg);
    const r = readResult(s.cfg, job.id);
    assert.equal(r.status, 'gate');
    assert.equal(r.phase, 'gate');
    assert.ok(r.gate.every((e) => e.path === "big.rs"));
    assert.ok(r.gate.some((e) => e.check === "file-length"), JSON.stringify(r.gate));
    assert.equal(r.commands.length, 0, 'no command ran');
    assert.equal(existsSync(join(s.root, 'big.rs')), false);
    assert.deepEqual(snapshot(s.root), before);
  } finally { s.done(); }
});

test('a clean patch passes the gate and runs', () => {
  const s = fixture();
  try {
    const { job } = buildPatchJob(s.cfg, {}, envelope(['beta', 'BETA']));
    writeJob(s.cfg, job);
    processOnce(s.cfg);
    assert.equal(readResult(s.cfg, job.id).status, 'passed');
  } finally { s.done(); }
});
