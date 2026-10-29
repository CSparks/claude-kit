// train-manifest.test.mjs — a Cargo.toml edit rides a train with disjoint code patches (KIT-T684): one build,
// one push, and the Cargo.lock the build rewrote lands in the manifest member's commit. Two jobs over one
// manifest never share a train (negative control).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture, g, trackCargo } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

function manifestFixture() {
  const s = trackCargo(fixture());
  for (const f of ['a.txt', 'b.txt']) writeFileSync(join(s.root, f), `${f} base\n`);
  writeFileSync(join(s.root, 'Cargo.lock'), 'lock base\n');
  g(['add', 'a.txt', 'b.txt', 'Cargo.lock'], s.root);
  g(['commit', '-m', 'files and lock'], s.root);
  g(['push', 'origin', 'main'], s.root);
  const counterDir = tempDir('train-manifest-');
  const counter = join(counterDir, 'runs.log').replace(/\\/g, '/');
  const cfg = normalizeBroker(s.root, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin' }] });
  // One build appends a line and rewrites Cargo.lock, as cargo does when a manifest changed.
  const build = `node -e "require('fs').appendFileSync('${counter}','run\\n');require('fs').writeFileSync('Cargo.lock','lock resolved\\n')"`;
  const builds = () => (existsSync(counter) ? readFileSync(counter, 'utf8').split('\n').filter(Boolean).length : 0);
  const queue = (envelope, ticket) => {
    const { job } = buildPatchJob(cfg, { ticket, land: true }, envelope);
    return writeJob(cfg, { ...job, commands: [build] });
  };
  return { ...s, cfg, queue, builds, done: () => { s.done(); cleanup(counterDir); } };
}

const edit = (file, from, to) => `*** edit ${file}\n<<<<<<< SEARCH\n${from}\n=======\n${to}\n>>>>>>> REPLACE\n`;
const filesIn = (root, sha) => g(['show', '--name-only', '--pretty=format:', sha], root).split('\n').map((l) => l.trim()).filter(Boolean);

test('a Cargo.toml edit trains with two code patches: one build; the rewritten lock lands with the manifest member', () => {
  const s = manifestFixture();
  try {
    const a = s.queue(edit('a.txt', 'a.txt base', 'a.txt new'), 'T-a');
    const m = s.queue(edit('Cargo.toml', 'members = []', 'members = [] # dep'), 'T-m');
    const b = s.queue(edit('b.txt', 'b.txt base', 'b.txt new'), 'T-b');
    processOnce(s.cfg);
    const [ra, rm, rb] = [a, m, b].map((j) => readResult(s.cfg, j.id));
    assert.deepEqual([ra.status, rm.status, rb.status], ['landed', 'landed', 'landed'], JSON.stringify([ra.message, rm.message, rb.message]));
    assert.equal(s.builds(), 1, 'one build carried all three');
    assert.equal(ra.train.id, rm.train.id);
    assert.deepEqual(filesIn(s.root, rm.landed.sha).sort(), ['Cargo.lock', 'Cargo.toml'], 'the lock rides the manifest member');
    assert.deepEqual(filesIn(s.root, ra.landed.sha), ['a.txt'], 'the code member carries only its file');
  } finally { s.done(); }
});

test('negative control: two jobs over the same manifest never share a train', () => {
  const s = manifestFixture();
  try {
    const m1 = s.queue(edit('Cargo.toml', 'members = []', 'members = [] # one'), 'T-1');
    const m2 = s.queue(edit('Cargo.toml', 'members = [] # one', 'members = [] # two'), 'T-2');
    processOnce(s.cfg);
    const r1 = readResult(s.cfg, m1.id);
    assert.ok(!r1.train || r1.train.size === 1, 'the second manifest job is not in the first one\'s train');
  } finally { s.done(); }
});
