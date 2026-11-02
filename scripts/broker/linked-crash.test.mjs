// linked-crash.test.mjs — a daemon killed between the submodule push and the superproject commit (KIT-T482 item 4):
// the restart lands the superproject half; with the old journal (no linked mark) the submodule tree is reversed.
// A real daemon runs; the superproject's pre-commit hook holds the commit for HOLD_S seconds, the test kills the daemon there.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { readInflight, recoverInflight } from './preimage.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { g } from './patchkit.mjs';
import { setup } from './subkit.mjs';
import { BOTH, linked, names } from './linkedkit.mjs';

const BROKER = join(import.meta.dirname, 'broker.mjs');
const POLL_MS = 50;
const WAIT_LIMIT_MS = 60_000;
const HOLD_S = 3;
const SETTLE_MS = (HOLD_S + 1) * 1000;
const HOLD_HOOK = `#!/bin/sh\nsleep ${HOLD_S}\n`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const exited = (child) => new Promise((r) => (child.exitCode !== null ? r(child.exitCode) : child.on('exit', r)));

async function until(what, ready) {
  const end = Date.now() + WAIT_LIMIT_MS;
  while (!ready()) { if (Date.now() > end) throw new Error(`never reached: ${what}`); await sleep(POLL_MS); }
}

async function killBetweenPushes(t) {
  const env = linked(t);
  mkdirSync(join(t.root, '.ai'), { recursive: true });
  writeFileSync(join(t.root, '.ai', 'config.yml'), 'broker:\n  batch: 1\n  repos:\n    - { name: super, path: ., main: main, remote: origin }\n    - { name: rapid-game, path: rapid-game, main: main, remote: origin, submodule: true, pin_in: . }\n');
  writeFileSync(join(t.root, '.git', 'hooks', 'pre-commit'), HOLD_HOOK, { mode: 0o755 });
  const { job } = buildPatchJob(t.cfg, { ticket: 'T-7', title: 'api v2 across a crash', land: true }, env('v2'));
  writeJob(t.cfg, { ...job, commands: [BOTH] });
  const first = spawn(process.execPath, [BROKER, '--root', t.root, '--once'], { stdio: 'ignore', windowsHide: true });
  await until('the submodule push', () => (readInflight(t.cfg) || {}).linked);
  first.kill('SIGKILL');
  await exited(first);
  await sleep(SETTLE_MS);
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
