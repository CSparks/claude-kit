// takeover.test.mjs — a lane daemon that picks up a job another daemon half-applied restores that
// job's own journal and runs it; a real foreign edit still blocks (KIT-T524).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { brokerPaths, withLane } from './config.mjs';
import { capture, readInflight } from './preimage.mjs';
import { processOnce } from './queue.mjs';
import { readResult, writeJob } from './result.mjs';
import { buildPatchJob } from './submit-lib.mjs';
import { g } from './patchkit.mjs';
import { PASS, setup } from './subkit.mjs';

// The submodule job j sits in the rapid-game lane queue; the root home's journal says an older
// daemon had started it and stopped after changing api.rs.
function handedOff({ journalFor = null, live = false } = {}) {
  const t = setup();
  writeFileSync(join(t.sub, 'api.rs'), 'original\n');
  g(['add', 'api.rs'], t.sub);
  g(['commit', '-m', 'api'], t.sub);
  g(['push', 'origin', 'main'], t.sub);
  const lane = withLane(t.cfg, 'rapid-game');
  const { job } = buildPatchJob(t.cfg, { repo: 'rapid-game', ticket: 'T-1' }, '*** write extra.txt\nnew\n');
  writeJob(lane, { ...job, commands: [PASS] });
  mkdirSync(brokerPaths(t.cfg).home, { recursive: true });
  capture(t.cfg, { id: journalFor || job.id, cwd: t.sub, paths: ['api.rs'] });
  writeFileSync(join(t.sub, 'api.rs'), 'half applied\n');
  if (live) writeFileSync(brokerPaths(t.cfg).lock, JSON.stringify({ pid: process.pid, host: hostname(), ts: new Date().toISOString() }));
  return { t, lane, job };
}

const api = (t) => readFileSync(join(t.sub, 'api.rs'), 'utf8');

test('a lane daemon restores the job\'s own half-applied files from another home\'s journal, then runs it', () => {
  const { t, lane, job } = handedOff();
  try {
    const summary = processOnce(lane);
    const r = readResult(lane, job.id);
    assert.equal(r.status, 'passed', JSON.stringify(r));
    assert.equal(summary.paused, false);
    assert.equal(api(t).replace(/\r\n/g, '\n'), 'original\n', 'the content is back, in the checkout\'s line endings (KIT-T552)');
    assert.equal(g(['status', '--porcelain'], t.sub), '', 'and git sees no change');
    assert.equal(readInflight(t.cfg), null, 'the journal is spent');
  } finally { t.done(); }
});

test('negative control: dirt with no journal for the job, or a journal for another job, still blocks', () => {
  for (const journalFor of [null, 'j-someone-else']) {
    const { t, lane, job } = journalFor ? handedOff({ journalFor }) : (() => {
      const h = handedOff();
      return h;
    })();
    try {
      if (!journalFor) writeFileSync(join(brokerPaths(t.cfg).home, 'inflight.json'), 'not json');
      const summary = processOnce(lane);
      assert.equal(summary.paused, true, String(journalFor));
      assert.equal(readResult(lane, job.id).status, 'dirty');
      assert.equal(api(t), 'half applied\n', 'the foreign edit is left alone');
    } finally { t.done(); }
  }
});

test('negative control: a journal held by a live daemon is not taken over', () => {
  const { t, lane, job } = handedOff({ live: true });
  try {
    assert.equal(processOnce(lane).paused, true);
    assert.equal(readResult(lane, job.id).status, 'dirty');
    assert.equal(api(t), 'half applied\n');
  } finally { t.done(); }
});
