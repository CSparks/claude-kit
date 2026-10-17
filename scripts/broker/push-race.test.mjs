// push-race.test.mjs — two checkouts of one remote land with no lock between them (KIT-D097). A's
// pre-push gate lets B land through its own daemon code first, so A's push is refused; A fetches,
// rebases onto B's commit, re-runs the gate and tests, and lands. A lock shared across checkouts
// would hold B out until A finished, which the gate waits on.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { normalizeBroker, withLane } from './config.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { envelope, fixture, g, originSha } from './patchkit.mjs';
import { cleanup, tempDir } from './testkit.mjs';

const posix = (p) => p.split(String.fromCharCode(92)).join('/');
const PASS = 'node -e "process.exit(0)"';
const here = (name) => pathToFileURL(join(import.meta.dirname, name)).href;
const laneCfg = (root) => withLane(normalizeBroker(root, {
  repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin', submodule: true, pre_push: true }], verify_default: [PASS],
}), 'app');

// B's landing, run from inside A's gate: the first gate run lands B's job, later runs pass.
function gateThatLandsOther(a, bRoot) {
  const dir = tempDir('race-hook-');
  const script = join(dir, 'land-b.mjs');
  const marker = join(dir, 'b-landed');
  writeFileSync(script, [
    "import { existsSync, writeFileSync } from 'node:fs';",
    `if (!existsSync(${JSON.stringify(marker)})) {`,
    `  writeFileSync(${JSON.stringify(marker)}, 'x');`,
    `  const { normalizeBroker, withLane } = await import(${JSON.stringify(here('config.mjs'))});`,
    `  const { processOnce } = await import(${JSON.stringify(here('queue.mjs'))});`,
    `  const { writeJob } = await import(${JSON.stringify(here('result.mjs'))});`,
    `  const { buildPatchJob } = await import(${JSON.stringify(here('submit-lib.mjs'))});`,
    `  const cfg = withLane(normalizeBroker(${JSON.stringify(bRoot)}, { repos: [{ name: 'app', path: '.', main: 'main', remote: 'origin', submodule: true }], verify_default: [${JSON.stringify(PASS)}] }), 'app');`,
    "  const { job } = buildPatchJob(cfg, { ticket: 'T-B', title: 'gamma', land: true }, " + JSON.stringify('*** write b.txt' + String.fromCharCode(10) + 'from b' + String.fromCharCode(10)) + ');',
    '  writeJob(cfg, job);',
    '  processOnce(cfg);',
    `  writeFileSync(${JSON.stringify(join(dir, 'b-job'))}, job.id);`,
    '}',
    '',
  ].join('\n'));
  const hooks = join(dir, 'hooks');
  mkdirSync(hooks);
  writeFileSync(join(hooks, 'pre-push'), `#!/bin/sh\nexec node "${posix(script)}"\n`);
  chmodSync(join(hooks, 'pre-push'), 0o755);
  g(['config', 'core.hooksPath', hooks], a.root);
  return { bJob: () => readFileSync(join(dir, 'b-job'), 'utf8'), done: () => cleanup(dir) };
}

test('two checkouts of one remote land at the same time and neither waits on the other: the refused push rebases and lands (KIT-D097)', () => {
  const a = fixture();
  const bRoot = tempDir('race-b-');
  try {
    g(['clone', '-q', a.bare, bRoot], a.root);
    for (const [k, v] of [['user.email', 'b@test'], ['user.name', 'B'], ['commit.gpgsign', 'false']]) g(['config', k, v], bRoot);
    const gate = gateThatLandsOther(a, bRoot);
    try {
      const cfg = laneCfg(a.root);
      const { job } = buildPatchJob(cfg, { ticket: 'T-A', title: 'beta', land: true }, envelope(['beta', 'BETA']));
      writeJob(cfg, job);
      processOnce(cfg);
      const rA = readResult(cfg, job.id);
      const rB = readResult(laneCfg(bRoot), gate.bJob());
      assert.equal(rB.status, 'landed', `B landed inside A's gate: ${JSON.stringify(rB)}`);
      assert.equal(rA.status, 'landed', JSON.stringify(rA));
      assert.equal(originSha(a.bare, a.root), rA.landed.sha);
      for (const [who, sha] of [['A', rA.landed.sha], ['B', rB.landed.sha]]) {
        assert.doesNotThrow(() => g(['merge-base', '--is-ancestor', sha, 'origin/main'], a.root), `${who}'s landed commit is reachable from origin/main`);
      }
      assert.equal(g(['rev-list', '--count', `${rB.landed.sha}..${rA.landed.sha}`], a.root), '1', 'A sits on B: one commit after it');
      assert.equal(readFileSync(join(a.root, 'src.txt'), 'utf8'), 'alpha\nBETA\ngamma\n');
      assert.equal(readFileSync(join(a.root, 'b.txt'), 'utf8'), 'from b\n', 'both checkouts work is on main');
      assert.equal(existsSync(join(a.root, '.git', 'rebase-merge')), false);
    } finally { gate.done(); }
  } finally { a.done(); cleanup(bRoot); }
});
