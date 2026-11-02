// wait-exit.test.mjs — wait.mjs exits 0 only for a finished-ok job, 1 for every other final status, 2 while the job is still
// queued or running, 3 for an unknown id, and its last stdout line names the state and the exit code (KIT-T840).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ensureDirs, writeJob, writeResult } from './result.mjs';
import { fixture } from './patchkit.mjs';

const WAIT = join(import.meta.dirname, 'wait.mjs');
const wait = (s, id) => spawnSync(process.execPath, [WAIT, id, '--root', s.root, '--timeout', '2', '--poll', '100', '--heartbeat', '0'], {
  encoding: 'utf8', env: { ...process.env, BROKER_NO_AUTOSTART: '1' },
});
const lastLine = (r) => r.stdout.trim().split('\n').pop();

for (const [status, code] of [['passed', 0], ['landed', 0], ['failed', 1], ['gate', 1], ['stale', 1], ['conflict', 1], ['dirty', 1]]) {
  test(`a ${status} result exits ${code} and says so on the last line`, () => {
    const s = fixture();
    try {
      ensureDirs(s.cfg);
      writeResult(s.cfg, { id: 'j-a', repo: 'app', status, phase: 'run', commands: [], landed: status === 'landed' ? { sha: 'abc1234' } : null, message: 'x' });
      const r = wait(s, 'j-a');
      assert.equal(r.status, code, r.stdout + r.stderr);
      assert.equal(lastLine(r), `wait: j-a ${status} (exit ${code})`);
    } finally { s.done(); }
  });
}

test('a job still queued exits 2 and the last line says STILL RUNNING, never a finished state', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    writeJob(s.cfg, { id: 'j-q', repo: 'app', ops: [] });
    const r = wait(s, 'j-q');
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.equal(lastLine(r), 'wait: j-q STILL RUNNING (exit 2)');
    assert.doesNotMatch(r.stdout, /\((exit 0)\)/);
  } finally { s.done(); }
});

test('an unknown job id exits 3 and says so', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    const r = wait(s, 'j-nope');
    assert.equal(r.status, 3);
    assert.equal(lastLine(r), 'wait: j-nope UNKNOWN JOB (exit 3)');
  } finally { s.done(); }
});
