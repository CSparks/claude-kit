// pause-repo.test.mjs — a dirty repo holds only its own jobs (KIT-T297): jobs for a clean repo
// run past it, and the held repo's later jobs keep their order behind the held one.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { normalizeBroker } from './config.mjs';
import { processOnce } from './queue.mjs';
import { listQueue, readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { cleanup, g, makeRepo, tempDir } from './testkit.mjs';

const PASS = 'node -e "process.exit(0)"';

// Two repos: `app` (dirty .rs when `dirtyApp`) and `lib`, a sibling checkout that is clean.
function twoRepos(dirtyApp) {
  const app = makeRepo(tempDir('prepo-app-'));
  const lib = makeRepo(tempDir('prepo-lib-'));
  mkdirSync(join(app, 'crates'), { recursive: true });
  writeFileSync(join(app, 'crates', 'a.rs'), 'base\n');
  g(['add', '-A'], app); g(['commit', '-m', 'rs'], app);
  if (dirtyApp) writeFileSync(join(app, 'crates', 'a.rs'), 'hot edit\n');
  const cfg = normalizeBroker(app, { repos: [{ name: 'app', path: '.' }, { name: 'lib', path: relative(app, lib) }], verify_default: [PASS] });
  const queue = (repo, file) => writeJob(cfg, { ...buildPatchJob(cfg, { repo }, `*** write ${file}\nx\n`).job, commands: [PASS] });
  return { cfg, queue, done: () => { cleanup(app); cleanup(lib); } };
}

test('a dirty repo holds its own jobs; a clean repo\'s job behind it still runs', () => {
  const t = twoRepos(true);
  try {
    const a1 = t.queue('app', 'a1.txt');
    const l1 = t.queue('lib', 'l1.txt');
    const a2 = t.queue('app', 'a2.txt');
    const sum = processOnce(t.cfg);
    assert.deepEqual([sum.paused, sum.pausedOn, sum.pausedRepos], [true, a1.id, ['app']]);
    assert.equal(readResult(t.cfg, l1.id).status, 'passed');
    assert.deepEqual(listQueue(t.cfg).map((j) => j.id), [a1.id, a2.id], 'app jobs stay queued, in order');
    assert.equal(readResult(t.cfg, a2.id), null, 'the second app job is not even tried');
  } finally { t.done(); }
});

test('negative: with every repo clean nothing is held and every job runs in order', () => {
  const t = twoRepos(false);
  try {
    const ids = [t.queue('app', 'a1.txt'), t.queue('lib', 'l1.txt'), t.queue('app', 'a2.txt')].map((j) => j.id);
    const sum = processOnce(t.cfg);
    assert.equal(sum.paused, false);
    assert.deepEqual(sum.processed.map((r) => r.id), ids);
  } finally { t.done(); }
});
