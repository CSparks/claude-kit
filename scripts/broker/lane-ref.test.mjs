// lane-ref.test.mjs — a submodule lane's submit dry run reads the commit the daemon will run on: when
// the lane's tree sits detached at the superproject pin behind its own branch (an earlier landing),
// a follow-up patch to a file that landing changed plans cleanly instead of reading as stale.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildPatchJob } from './submit-lib.mjs';
import { laneRef } from './lane-ref.mjs';
import { g } from './patchkit.mjs';
import { setup } from './subkit.mjs';

const edit = (path, from, to) => `*** edit ${path}\n<<<<<<< SEARCH\n${from}\n=======\n${to}\n>>>>>>> REPLACE\n`;

function laneBehindItsBranch() {
  const t = setup();
  const pin = g(['rev-parse', 'HEAD'], t.sub);
  writeFileSync(join(t.sub, 'api.txt'), 'landed\n');
  g(['add', 'api.txt'], t.sub);
  g(['commit', '-m', 'earlier landing'], t.sub);
  const ahead = g(['rev-parse', 'HEAD'], t.sub);
  g(['checkout', '-q', '--detach', pin], t.sub);
  return { t, pin, ahead };
}

test('detached at an ancestor of main: the dry run reads main, so a file the earlier landing created is found', () => {
  const { t, pin, ahead } = laneBehindItsBranch();
  try {
    const sub = t.cfg.repos.find((r) => r.name === 'rapid-game');
    assert.equal(laneRef(sub, t.sub), 'main');
    const out = buildPatchJob(t.cfg, { repo: 'rapid-game', ticket: 'T-1', title: 'follow-up' }, edit('api.txt', 'landed', 'revised'));
    assert.ok(out.job, JSON.stringify(out.result || out.error));
    assert.equal(out.job.base, ahead, 'the job is based on the commit the daemon will use');
    assert.notEqual(out.job.base, pin);
  } finally { t.done(); }
});

test('negative control: the same patch on a lane whose tree reads HEAD (not a submodule) is stale', () => {
  const { t } = laneBehindItsBranch();
  try {
    const sub = { ...t.cfg.repos.find((r) => r.name === 'rapid-game'), submodule: false };
    assert.equal(laneRef(sub, t.sub), 'HEAD');
    const stale = buildPatchJob({ ...t.cfg, repos: t.cfg.repos.map((r) => (r.name === 'rapid-game' ? sub : r)) }, { repo: 'rapid-game', ticket: 'T-1', title: 'follow-up' }, edit('api.txt', 'landed', 'revised'));
    assert.equal(stale.result.status, 'stale');
  } finally { t.done(); }
});

test('diverged or attached trees keep reading HEAD', () => {
  const { t } = laneBehindItsBranch();
  try {
    const sub = t.cfg.repos.find((r) => r.name === 'rapid-game');
    g(['checkout', '-q', 'main'], t.sub);
    assert.equal(laneRef(sub, t.sub), 'HEAD', 'on a branch');
    g(['checkout', '-q', '--detach', 'main'], t.sub);
    writeFileSync(join(t.sub, 'api.txt'), 'detached work\n');
    g(['add', 'api.txt'], t.sub);
    g(['commit', '-m', 'detached only'], t.sub);
    assert.equal(laneRef(sub, t.sub), 'HEAD', 'HEAD is ahead of main, not behind it');
  } finally { t.done(); }
});
