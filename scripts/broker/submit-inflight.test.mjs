// submit-inflight.test.mjs — a submit planned while the daemon's check-only run holds a created
// file in the tree is not stale `create-exists`; a stranger's file at that path still is (KIT-T503).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { capture, discard } from './preimage.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { ensureDirs } from './result.mjs';
import { fixture } from './patchkit.mjs';

test('writes of a path the in-flight run created queue; the same file with no journal is create-exists (control)', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    capture(s.cfg, { id: 'j-inflight', cwd: s.root, paths: ['new.txt'] });
    writeFileSync(join(s.root, 'new.txt'), 'written by the in-flight check-only run\n');
    const queued = buildPatchJob(s.cfg, {}, '*** write new.txt\nmine\n');
    assert.ok(queued.job, JSON.stringify(queued.result && queued.result.stale));
    discard(s.cfg);
    const stale = buildPatchJob(s.cfg, {}, '*** write new.txt\nmine\n');
    assert.equal(stale.result.stale[0].reason, 'create-exists');
  } finally { s.done(); }
});
