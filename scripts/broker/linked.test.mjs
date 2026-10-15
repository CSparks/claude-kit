// linked.test.mjs — one superproject job that also edits its submodule (KIT-T482 item 4): the
// submodule commit is pushed first, then ONE superproject commit carries the consumer change and
// the new gitlink; a red build lands neither half; a failed superproject push leaves the pushed
// submodule commit in place and names it; a daemon killed between the two pushes is finished on restart.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { readInflight, recoverInflight } from './preimage.mjs';
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

// A real daemon killed between the submodule push and the superproject commit: the superproject's
// pre-commit hook holds the commit for HOLD_S seconds, the test kills the daemon there.
const HOLD_S = 5;
const BROKER = join(import.meta.dirname, 'broker.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exited = (child) => new Promise((r) => (child.exitCode !== null ? r(child.exitCode) : child.on('exit', r)));

async function killBetweenPushes(t) {
  const env = linked(t);
  mkdirSync(join(t.root, '.ai'), { recursive: true });
  writeFileSync(join(t.root, '.ai', 'config.yml'), 'broker:\n  batch: 1\n  repos:\n    - { name: super, path: ., main: main, remote: origin }\n    - { name: rapid-game, path: rapid-game, main: main, remote: origin, submodule: true, pin_in: . }\n');
  writeFileSync(join(t.root, '.git', 'hooks', 'pre-commit'), `#!/bin/sh\nsleep ${HOLD_S}\n`, { mode: 0o755 });
  const { job } = buildPatchJob(t.cfg, { ticket: 'T-7', title: 'api v2 across a crash', land: true }, env('v2'));
  writeJob(t.cfg, { ...job, commands: [BOTH] });
  const first = spawn(process.execPath, [BROKER, '--root', t.root, '--once'], { stdio: 'ignore', windowsHide: true });
  const end = Date.now() + 300_000;
  while (!(readInflight(t.cfg) || {}).linked) { if (Date.now() > end) throw new Error('never reached the submodule push'); await sleep(50); }
  first.kill('SIGKILL');
  await exited(first);
  await sleep((HOLD_S + 2) * 1000);
  rmSync(join(t.root, '.git', 'hooks', 'pre-commit'), { force: true });
  rmSync(brokerPaths(t.cfg).lock, { force: true });
  return job;
}
const daemonOnce = async (root) => exited(spawn(process.execPath, [BROKER, '--root', root, '--once'], { stdio: 'ignore', windowsHide: true }));

test('a daemon killed between the submodule push and the superproject commit: the restart lands the superproject half', async () => {
  const t = setup();
  try {
    const job = await killBetweenPushes(t);
    const subSha = g(['--git-dir', t.subBare, 'rev-parse', 'main'], t.root);
    assert.equal(g(['rev-parse', 'HEAD'], t.sub), subSha, 'the submodule half was pushed before the kill');
    await daemonOnce(t.root);
    const r = readResult(t.cfg, job.id);
    assert.equal(r.status, 'landed', r.message);
    assert.equal(r.landed.subSha, subSha);
    assert.equal(g(['rev-parse', 'HEAD:rapid-game'], t.root), subSha, 'the superproject pins the pushed submodule commit');
    assert.deepEqual(names(t.root), ['api.txt', 'rapid-game']);
    assert.equal(g(['--git-dir', t.superBare, 'rev-parse', 'main'], t.root), g(['rev-parse', 'HEAD'], t.root), 'pushed');
    assert.equal(readFileSync(join(t.root, 'api.txt'), 'utf8'), 'v2\n');
    assert.equal(g(['status', '--porcelain'], t.sub), '', 'the submodule tree matches its commit');
    assert.equal(readInflight(t.cfg), null);
  } finally { t.done(); }
});

test('negative control: the same crash with the old journal (no linked mark, submodule pre-images kept) reverses the submodule tree', async () => {
  const t = setup();
  try {
    await killBetweenPushes(t);
    const { linked: mark, ...old } = readInflight(t.cfg);
    assert.ok(mark);
    const pre = join(brokerPaths(t.cfg).home, 'v1.txt');
    writeFileSync(pre, 'v1\n');
    const v1 = g(['hash-object', '-w', pre], t.root);
    writeFileSync(join(brokerPaths(t.cfg).home, 'inflight.json'), JSON.stringify({ ...old, entries: [...old.entries, { path: 'rapid-game/api.txt', blob: v1 }] }));
    recoverInflight(t.cfg);
    assert.match(g(['status', '--porcelain'], t.sub), /^ ?M api\.txt/m, 'pre-images over the pushed commit');
    assert.equal(readFileSync(join(t.sub, 'api.txt'), 'utf8'), 'v1\n', 'the submodule file went back to v1 under a v2 commit');
  } finally { t.done(); }
});
