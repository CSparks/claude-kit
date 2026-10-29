// check-tree-train.test.mjs — a train builds in the check tree too (KIT-T698): the live checkout stays untouched while
// its commands run, and landing members reach it only after the train is green.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { liveState } from './live-patch.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { fixture, g, snapshot } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const fwd = (p) => p.split(String.fromCharCode(92)).join('/');
const edit = (file) => `*** edit ${file}\n<<<<<<< SEARCH\n${file} base\n=======\n${file} new\n>>>>>>> REPLACE\n`;

function setup() {
  const s = fixture();
  for (const f of ['a.txt', 'b.txt']) writeFileSync(join(s.root, f), `${f} base\n`);
  g(['add', 'a.txt', 'b.txt'], s.root);
  g(['commit', '-m', 'two files'], s.root);
  g(['push', 'origin', 'main'], s.root);
  s.cfg.checkTree = true;
  const dir = tempDir('check-train-');
  const seen = fwd(join(dir, 'seen.txt'));
  const live = fwd(s.root);
  const command = `node -e "const fs=require('fs');fs.appendFileSync('${seen}',fs.readFileSync('${live}/a.txt','utf8').trim()+'|'+fs.readFileSync('a.txt','utf8').trim()+'\\n')"`;
  const queue = (file, land) => {
    const { job } = buildPatchJob(s.cfg, { ticket: `T-${file[0]}`, title: `edit ${file}`, land }, edit(file));
    return writeJob(s.cfg, { ...job, commands: [command] });
  };
  const lines = () => (existsSync(join(dir, 'seen.txt')) ? readFileSync(join(dir, 'seen.txt'), 'utf8').trim().split('\n') : []);
  return { s, queue, lines, done: () => { cleanup(dir); s.done(); } };
}

test('two check-only jobs build as one train in the check tree and leave the live checkout alone', () => {
  const t = setup();
  try {
    const before = snapshot(t.s.root);
    const [a, b] = [t.queue('a.txt', false), t.queue('b.txt', false)];
    processOnce(t.s.cfg);
    const [ra, rb] = [readResult(t.s.cfg, a.id), readResult(t.s.cfg, b.id)];
    assert.deepEqual([ra.status, rb.status], ['passed', 'passed']);
    assert.equal(ra.train.id, rb.train.id, 'one train carried both');
    assert.deepEqual(t.lines(), ['a.txt base|a.txt new'], 'one build: the live file was the original, the check tree held the patch');
    assert.deepEqual(snapshot(t.s.root), before);
  } finally { t.done(); }
});

test('two landing jobs build in the check tree, then land together from the live checkout', () => {
  const t = setup();
  try {
    const head = g(['rev-parse', 'HEAD'], t.s.root);
    const [a, b] = [t.queue('a.txt', true), t.queue('b.txt', true)];
    processOnce(t.s.cfg);
    const [ra, rb] = [readResult(t.s.cfg, a.id), readResult(t.s.cfg, b.id)];
    assert.deepEqual([ra.status, rb.status], ['landed', 'landed'], JSON.stringify([ra.message, rb.message]));
    assert.equal(ra.train.id, rb.train.id);
    assert.deepEqual(t.lines(), ['a.txt base|a.txt new'], 'the build ran once, before the live checkout was written');
    assert.equal(g(['rev-list', '--count', `${head}..HEAD`], t.s.root), '2', 'two commits landed');
    assert.equal(readFileSync(join(t.s.root, 'a.txt'), 'utf8'), 'a.txt new\n');
    assert.equal(liveState(t.s.cfg).patched, false);
  } finally { t.done(); }
});

test('a red train lands nothing and the live checkout is untouched', () => {
  const t = setup();
  try {
    const before = snapshot(t.s.root);
    const [a, b] = [t.queue('a.txt', true), t.queue('b.txt', true)];
    for (const id of [a.id, b.id]) {
      const file = join(t.s.cfg.targetDir, 'broker', 'queue', `${id}.json`);
      writeFileSync(file, JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), commands: ['node -e "process.exit(1)"'] }));
    }
    processOnce(t.s.cfg);
    assert.deepEqual([a, b].map((j) => readResult(t.s.cfg, j.id).status), ['failed', 'failed']);
    assert.deepEqual(snapshot(t.s.root), before);
  } finally { t.done(); }
});
