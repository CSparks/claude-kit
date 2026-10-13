// lock-leak.test.mjs — a check-only run that adds a dependency leaves no Cargo.lock behind
// (KIT-T296): the run's resolved lock is restored whether the job passes or fails, so the next
// job finds a clean checkout instead of pausing the queue.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { writeJob, readResult } from './result.mjs';
import { tempDir, cleanup, makeRepo, g } from './testkit.mjs';
import { buildPatchJob } from './submit-lib.mjs';

const PASS = 'node -e "process.exit(0)"';
const RESOLVE_THEN_FAIL = `node -e "const f=require('fs');f.writeFileSync('Cargo.lock','resolved');f.mkdirSync('sub',{recursive:true});f.writeFileSync('sub/Cargo.lock','new');process.exit(1)"`;
const put = (root, rel, text) => { mkdirSync(dirname(join(root, rel)), { recursive: true }); writeFileSync(join(root, rel), text); };

test('a failed run of a dependency-adding patch leaves every Cargo.lock as found and the next job runs', () => {
  const root = makeRepo(tempDir('lock-leak-'));
  put(root, 'Cargo.lock', 'base\n');
  g(['add', '-A'], root); g(['commit', '-m', 'lock'], root);
  const cfg = normalizeBroker(root, { repos: [{ name: 'app', path: '.' }], verify_default: [PASS] });
  try {
    const add = buildPatchJob(cfg, {}, '*** write crates/new/Cargo.toml\n[dependencies]\nrg-landform = "1"\n').job;
    writeJob(cfg, { ...add, commands: [RESOLVE_THEN_FAIL] });
    processOnce(cfg);
    assert.equal(readResult(cfg, add.id).status, 'failed');
    assert.equal(readFileSync(join(root, 'Cargo.lock'), 'utf8'), 'base\n');
    assert.equal(g(['status', '--porcelain', '-uall'], root), '', 'no lock, manifest or directory is left in the live tree');

    const next = buildPatchJob(cfg, {}, '*** write p.txt\np\n').job;
    writeJob(cfg, { ...next, commands: [PASS] });
    processOnce(cfg);
    assert.equal(readResult(cfg, next.id).status, 'passed', 'the next job is not paused on a dirty checkout');
  } finally { cleanup(root); }
});
