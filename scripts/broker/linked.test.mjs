// linked.test.mjs — one superproject job that also edits its submodule (KIT-T482 item 4): the
// submodule commit is pushed first, then ONE superproject commit carries the consumer change and
// the new gitlink; a red build lands neither half; a failed superproject push leaves the pushed
// submodule commit in place and names it.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { g } from './patchkit.mjs';
import { setup } from './subkit.mjs';

const BOTH = 'node -e "const fs=require(\'fs\');process.exit(fs.readFileSync(\'api.txt\',\'utf8\').trim()===fs.readFileSync(\'rapid-game/api.txt\',\'utf8\').trim()?0:1)"';

function linked(t) {
  writeFileSync(join(t.sub, 'api.txt'), 'v1\n');
  g(['add', 'api.txt'], t.sub);
  g(['commit', '-m', 'api v1'], t.sub);
  g(['push', 'origin', 'main'], t.sub);
  writeFileSync(join(t.root, 'api.txt'), 'v1\n');
  g(['add', 'api.txt', 'rapid-game'], t.root);
  g(['commit', '-m', 'consume api v1'], t.root);
  g(['push', 'origin', 'main'], t.root);
  const env = (consumer) => `*** edit rapid-game/api.txt\n<<<<<<< SEARCH\nv1\n=======\nv2\n>>>>>>> REPLACE\n*** edit api.txt\n<<<<<<< SEARCH\nv1\n=======\n${consumer}\n>>>>>>> REPLACE\n`;
  return env;
}

const names = (cwd) => g(['show', '--name-only', '--pretty=format:', 'HEAD'], cwd).split('\n').map((l) => l.trim()).filter(Boolean).sort();

test('a linked job lands the submodule half, then one superproject commit with the consumer change and the gitlink', () => {
  const t = setup();
  try {
    const env = linked(t);
    const { out, r } = t.run({ ticket: 'T-7', title: 'api v2 end to end', land: true }, env('v2'), [BOTH]);
    assert.ok(out.job, JSON.stringify(out));
    assert.equal(r.status, 'landed', r.message);
    const subSha = g(['rev-parse', 'HEAD'], t.sub);
    assert.equal(r.landed.subSha, subSha);
    assert.equal(g(['--git-dir', t.subBare, 'rev-parse', 'main'], t.root), subSha, 'the submodule commit is pushed');
    assert.deepEqual(names(t.root), ['api.txt', 'rapid-game'], 'one superproject commit: consumer change + gitlink');
    assert.equal(g(['rev-parse', 'HEAD:rapid-game'], t.root), subSha);
    assert.equal(g(['--git-dir', t.superBare, 'rev-parse', 'main'], t.root), g(['rev-parse', 'HEAD'], t.root));
    assert.equal(g(['status', '--porcelain'], t.root), '', 'both trees clean');
    assert.equal(readFileSync(join(t.sub, 'api.txt'), 'utf8'), 'v2\n');
  } finally { t.done(); }
});

test('negative control: a red linked build lands neither half and restores both trees', () => {
  const t = setup();
  try {
    const env = linked(t);
    const subBefore = g(['rev-parse', 'HEAD'], t.sub);
    const superBefore = g(['rev-parse', 'HEAD'], t.root);
    const { r } = t.run({ ticket: 'T-7', title: 'api v2 half done', land: true }, env('v1-still'), [BOTH]);
    assert.equal(r.status, 'failed');
    assert.equal(g(['rev-parse', 'HEAD'], t.sub), subBefore);
    assert.equal(g(['--git-dir', t.subBare, 'rev-parse', 'main'], t.root), subBefore, 'nothing pushed to the submodule');
    assert.equal(g(['rev-parse', 'HEAD'], t.root), superBefore);
    assert.equal(readFileSync(join(t.sub, 'api.txt'), 'utf8'), 'v1\n');
    assert.equal(g(['status', '--porcelain'], t.root), '');
  } finally { t.done(); }
});

test('a superproject push that fails after the submodule landed keeps the submodule commit and names it', () => {
  const t = setup();
  try {
    const env = linked(t);
    writeFileSync(join(t.superBare, 'hooks', 'pre-receive'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const { r } = t.run({ ticket: 'T-7', title: 'api v2, super refused', land: true }, env('v2'), [BOTH]);
    assert.equal(r.status, 'failed');
    const subSha = g(['--git-dir', t.subBare, 'rev-parse', 'main'], t.root);
    assert.match(r.message, new RegExp(`rapid-game ${subSha.slice(0, 10)} landed and pushed; the super half .* did not.*--pin rapid-game=${subSha}`, 's'));
    assert.equal(g(['rev-parse', 'HEAD'], t.sub), subSha, 'the submodule stays at its pushed commit');
    assert.equal(g(['status', '--porcelain'], t.sub), '', 'its files are not restored over the commit');
  } finally { t.done(); }
});

test('a linked job never rides a train', () => {
  const t = setup({ batch: 8 });
  try {
    const env = linked(t);
    const one = buildPatchJob(t.cfg, { ticket: 'T-7', title: 'linked', land: true }, env('v2')).job;
    const other = buildPatchJob(t.cfg, { ticket: 'T-8', title: 'other' }, '*** write notes.md\nx\n').job;
    writeJob(t.cfg, { ...one, commands: [BOTH] });
    writeJob(t.cfg, { ...other, commands: ['node -e 0'] });
    processOnce(t.cfg);
    assert.equal(readResult(t.cfg, one.id).status, 'landed');
    assert.equal(readResult(t.cfg, one.id).train, undefined);
  } finally { t.done(); }
});
