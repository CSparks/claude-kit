// wait-guard.test.mjs — a wait on a pending job never leaves a failing exit code (KIT-T851): a stripped console,
// a signal or a throw in the poll loop ends it as STILL RUNNING (exit 2); the window fits the Bash tool call.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { ensureDirs, writeJob } from './result.mjs';
import { fixture } from './patchkit.mjs';
import { armWaitGuard } from './wait-guard.mjs';
import { DEFAULT_TOOL_TIMEOUT_S, MAX_FOREGROUND_WAIT_S, TOOL_MARGIN_S, waitWindow } from './wait-limits.mjs';

const streams = () => ({ stdout: new EventEmitter(), stderr: Object.assign(new EventEmitter(), { write() {} }) });
const fakeProc = () => Object.assign(new EventEmitter(), { exit(code) { this.exited = code; } });

test('a write error on a stripped console is swallowed, not thrown', () => {
  const { stdout, stderr } = streams();
  armWaitGuard(() => {}, { stdout, stderr, proc: fakeProc() });
  assert.doesNotThrow(() => { stdout.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' })); stderr.emit('error', new Error('write EPIPE')); });
});

for (const sig of ['SIGTERM', 'SIGHUP', 'SIGINT']) {
  test(`${sig} while armed finishes as pending, once`, () => {
    const proc = fakeProc();
    let ends = 0;
    armWaitGuard(() => { ends += 1; }, { ...streams(), proc });
    proc.emit(sig);
    proc.emit(sig);
    assert.equal(ends, 1);
  });
}

test('a throw while armed finishes as pending and does not exit 1', () => {
  const proc = fakeProc();
  let ends = 0;
  armWaitGuard(() => { ends += 1; }, { ...streams(), proc });
  proc.emit('uncaughtException', new Error('heartbeat blew up'));
  assert.equal(ends, 1);
  assert.equal(proc.exited, undefined);
});

test('negative: once disarmed a throw is a real failure (exit 1) and the wait is not called pending', () => {
  const proc = fakeProc();
  let ends = 0;
  const disarm = armWaitGuard(() => { ends += 1; }, { ...streams(), proc });
  disarm();
  proc.emit('uncaughtException', new Error('printResult failed'));
  assert.equal(ends, 0);
  assert.equal(proc.exited, 1);
});

test('the window is the asked timeout cut to the tool window minus the margin', () => {
  assert.deepEqual(waitWindow({ timeout: '280' }), { seconds: DEFAULT_TOOL_TIMEOUT_S - TOOL_MARGIN_S, clamped: true, asked: 280, ceiling: DEFAULT_TOOL_TIMEOUT_S - TOOL_MARGIN_S });
  assert.equal(waitWindow({ timeout: '120', 'tool-timeout': '180' }).seconds, 120);
  assert.equal(waitWindow({ timeout: '170', 'tool-timeout': '180' }).clamped, false);
  assert.equal(waitWindow({ timeout: '280', 'tool-timeout': '290' }).seconds, MAX_FOREGROUND_WAIT_S, 'the harness cap, not the named tool timeout, bounds the wait');
  assert.equal(waitWindow({ timeout: '300', 'tool-timeout': '600' }).seconds, MAX_FOREGROUND_WAIT_S);
  assert.equal(MAX_FOREGROUND_WAIT_S, 170);
  assert.equal(waitWindow({}).seconds, 100);
  assert.equal(waitWindow({ timeout: '30' }).clamped, false);
});

test('wait asked for more than its tool window ends inside it with exit 2 and says it was cut', () => {
  const s = fixture();
  try {
    ensureDirs(s.cfg);
    writeJob(s.cfg, { id: 'j-q', repo: 'app', ops: [] });
    const r = spawnSync(process.execPath, [join(import.meta.dirname, 'wait.mjs'), 'j-q', '--root', s.root, '--timeout', '500', '--tool-timeout', '11', '--poll', '100', '--heartbeat', '0'], {
      encoding: 'utf8', env: { ...process.env, BROKER_NO_AUTOSTART: '1' }, timeout: 20000,
    });
    assert.equal(r.status, 2, r.stdout + r.stderr);
    assert.match(r.stderr, /cut to 1 s/);
    assert.equal(r.stdout.trim().split('\n').pop(), 'wait: j-q STILL RUNNING (exit 2)');
  } finally { s.done(); }
});
