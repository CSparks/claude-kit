// wait.test.mjs — wait.mjs reports a result only when it belongs to the job's current attempt (KIT-T308).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { isCurrentResult } from './current.mjs';
import { capture } from './preimage.mjs';
import { ensureDirs, writeResult } from './result.mjs';
import { fixture } from './patchkit.mjs';

const WAIT = join(import.meta.dirname, 'wait.mjs');
const wait = (s, id) => spawnSync(process.execPath, [WAIT, id, '--root', s.root, '--timeout', '2', '--poll', '100'], { encoding: 'utf8' });
const staleDirty = (s, id) => writeResult(s.cfg, { id, repo: 'app', status: 'dirty', phase: 'apply', finishedAt: new Date(Date.now() - 60_000).toISOString(), message: 'build checkout dirty' });

test('a result older than the same job id\'s inflight start is not final: wait keeps waiting and times out', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    staleDirty(s, 'j-a');
    capture(s.cfg, { id: 'j-a', cwd: s.root, paths: [] });
    assert.equal(isCurrentResult(s.cfg, { id: 'j-a', finishedAt: new Date(Date.now() - 60_000).toISOString() }), false);
    const r = wait(s, 'j-a');
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.doesNotMatch(r.stdout, /dirty/);
  } finally { s.done(); }
});

test('negative: the same result with no inflight run, or another job inflight, is final', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    staleDirty(s, 'j-a');
    let r = wait(s, 'j-a');
    assert.equal(r.status, 1);
    assert.match(r.stdout, /j-a.*dirty/);
    capture(s.cfg, { id: 'j-other', cwd: s.root, paths: [] });
    r = wait(s, 'j-a');
    assert.equal(r.status, 1, 'another job inflight does not hide this one\'s result');
  } finally { s.done(); }
});

test('a result written during the current run is final', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    capture(s.cfg, { id: 'j-a', cwd: s.root, paths: [] });
    const done = writeResult(s.cfg, { id: 'j-a', repo: 'app', status: 'passed', phase: 'run', commands: [] });
    assert.equal(isCurrentResult(s.cfg, done), true);
    assert.equal(wait(s, 'j-a').status, 0);
  } finally { s.done(); }
});
