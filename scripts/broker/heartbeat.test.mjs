// heartbeat.test.mjs — wait.mjs prints where a blocked job is, once per --heartbeat (KIT-T483).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { heartbeatLine } from './heartbeat.mjs';
import { capture } from './preimage.mjs';
import { ensureDirs, writeJob } from './result.mjs';
import { fixture } from './patchkit.mjs';

const WAIT = join(import.meta.dirname, 'wait.mjs');

test('a queued job reports its position and the running job; a running one its time and command', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    writeJob(s.cfg, { id: 'j-1-a', repo: 'app', ops: [] });
    writeJob(s.cfg, { id: 'j-2-b', repo: 'app', ops: [] });
    const journal = capture(s.cfg, { id: 'j-1-a', cwd: s.root, paths: [] });
    assert.equal(heartbeatLine(s.cfg, 'j-2-b'), 'wait: j-2-b queued at position 2 of 2; j-1-a is running');
    writeFileSync(join(brokerPaths(s.cfg).logs, 'j-1-a-0.log'), '');
    writeFileSync(join(brokerPaths(s.cfg).logs, 'j-1-a-1.log'), '');
    const at = Date.parse(journal.startedAt) + 75_000;
    assert.equal(heartbeatLine(s.cfg, 'j-1-a', at), 'wait: j-1-a running 75s, on command 2');
  } finally { s.done(); }
});

test('wait prints the heartbeat while it blocks; negative: --heartbeat 0 prints none and an unknown job gets none', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    writeJob(s.cfg, { id: 'j-9-z', repo: 'app', ops: [] });
    const run = (beat) => spawnSync(process.execPath, [WAIT, 'j-9-z', '--root', s.root, '--timeout', '3', '--poll', '200', '--heartbeat', beat, '--grace-ms', '600000'], { encoding: 'utf8' });
    assert.match(run('1').stderr, /wait: j-9-z queued at position 1 of 1/);
    assert.doesNotMatch(run('0').stderr, /queued at position/);
    assert.equal(heartbeatLine(s.cfg, 'j-unknown'), null);
  } finally { s.done(); }
});
