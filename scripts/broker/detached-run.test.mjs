// detached-run.mjs — `builds --run` / `builds --result` (KIT-T1283): a long command runs once in a process that outlives the
// launcher, its end is a finished.log line, and the refusals of sleeping and polling name the verb.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeRun, readRun, startRun, waitRun } from './detached-run.mjs';

const HOOKS = fileURLToPath(new URL('../../hooks/', import.meta.url));
const STATUS_CLI = fileURLToPath(new URL('./build-status.mjs', import.meta.url));
const LONG_S = 60;

function checkout() {
  const root = mkdtempSync(join(tmpdir(), 'dr-'));
  execFileSync('git', ['init', '-q'], { cwd: root });
  mkdirSync(join(root, '.ai'));
  return root;
}
const script = (root, body) => {
  const file = join(root, `s${Math.random().toString(36).slice(2, 6)}.mjs`);
  writeFileSync(file, body);
  return `node "${file.replace(/\\/g, '/')}"`;
};
const finishedLog = (root) => { try { return readFileSync(join(root, 'target', 'broker', 'finished.log'), 'utf8'); } catch { return ''; } };

test('a command that ends inside the wait window reports its exit, its output and a finished.log line', () => {
  const root = checkout();
  const command = script(root, "console.log('probe frame 1'); console.log('probe frame 2'); setTimeout(() => process.exit(3), 800);");
  const record = startRun({ command, cwd: root, root, writer: 'S1|agentX' });
  const ended = waitRun(root, record.id, { capS: 20 });
  assert.equal(ended.status, 'ended');
  assert.equal(ended.exit, 3);
  const text = describeRun(ended);
  assert.match(text, /ended with exit 3/);
  assert.match(text, /probe frame 2/);
  assert.match(finishedLog(root), new RegExp(`${record.id} exit3 agent=agentX ticket=-`));
});

test('a command longer than the wait window keeps running after the launcher stopped waiting, and names how to resume', () => {
  const root = checkout();
  const command = script(root, "console.log('started'); setTimeout(() => process.exit(0), 3000);");
  const record = startRun({ command, cwd: root, root });
  const early = waitRun(root, record.id, { capS: 1 });
  assert.equal(early.status, 'running');
  const text = describeRun(early);
  assert.match(text, new RegExp(`${record.id}`));
  assert.match(text, /still running/);
  assert.match(text, /finished\.log/);
  assert.match(text, /builds --result run-/);
  assert.match(text, /Do not sleep or poll/);
  assert.equal(finishedLog(root), '', 'no finished line while it runs');
  const later = waitRun(root, record.id, { capS: 20 });
  assert.equal(later.status, 'ended', 'the worker needed no launcher to finish');
  assert.match(finishedLog(root), new RegExp(`${record.id} exit0`));
});

test('a command past its limit is stopped and recorded as a timeout', () => {
  const root = checkout();
  const command = script(root, `setTimeout(() => {}, ${LONG_S * 1000});`);
  const record = startRun({ command, cwd: root, root, limitS: 2 });
  const ended = waitRun(root, record.id, { capS: 30 });
  assert.equal(ended.status, 'timeout');
  assert.match(describeRun(ended), /stopped at its 2 s limit/);
  assert.match(finishedLog(root), new RegExp(`${record.id} timeout`));
  assert.throws(() => process.kill(ended.pid, 0), 'the stopped command is gone');
});

test('the output goes to the named file, relative to the working directory', () => {
  const root = checkout();
  const record = startRun({ command: script(root, "console.log('to a file');"), cwd: root, root, out: 'target/probe/out.txt' });
  waitRun(root, record.id, { capS: 20 });
  assert.match(readFileSync(join(root, 'target', 'probe', 'out.txt'), 'utf8'), /to a file/);
  assert.equal(readRun(root, record.id).out, join(root, 'target', 'probe', 'out.txt'));
});

test('builds --run and builds --result work from the command line: exit codes, one read of the record, no such run', () => {
  const root = checkout();
  const command = script(root, "console.log('cli ok'); process.exit(0);");
  const run = spawnSync(process.execPath, [STATUS_CLI, '--run', command, '--timeout', '30', '--tool-timeout', '60'], { cwd: root, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /ended with exit 0/);
  const id = /run (run-\S+?):/.exec(run.stdout)[1];
  const result = spawnSync(process.execPath, [STATUS_CLI, '--result', id], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /cli ok/);
  assert.equal(spawnSync(process.execPath, [STATUS_CLI, '--result', 'run-nope'], { cwd: root, encoding: 'utf8' }).status, 64);
  const slow = spawnSync(process.execPath, [STATUS_CLI, '--run', script(root, 'setTimeout(() => {}, 4000);'), '--timeout', '2', '--tool-timeout', '30'], { cwd: root, encoding: 'utf8' });
  assert.equal(slow.status, 2, 'a run still going at the end of the window exits 2');
  assert.match(slow.stdout, /still running/);
  const slowId = /run (run-\S+?):/.exec(slow.stdout)[1];
  assert.equal(waitRun(root, slowId, { capS: 20 }).status, 'ended', 'the launcher process had exited; the worker finished the run alone');
  assert.equal(spawnSync(process.execPath, [STATUS_CLI, '--run'], { cwd: root, encoding: 'utf8' }).status, 64);
});

test('the refusals of a sleep and of a poll name the verb that waits for a long run', () => {
  const root = checkout();
  const gate = (name, payload) => spawnSync(process.execPath, [join(HOOKS, name)], { cwd: root, encoding: 'utf8', env: { ...process.env, CLAUDE_KIT_TURN_STATE: mkdtempSync(join(tmpdir(), 'dr-state-')) }, input: JSON.stringify(payload) });
  const sleeping = gate('broker-wait-gate.mjs', { tool_name: 'Bash', session_id: 'S1', agent_id: 'a1b2c3d4e5f6a7b8c', tool_input: { command: 'sleep 45; cat target/broker/finished.log' } });
  assert.equal(sleeping.status, 2);
  assert.match(sleeping.stderr, /builds --run "<command>" --out <file>/);
  assert.match(sleeping.stderr, /builds --result <id>/);
  const control = gate('broker-wait-gate.mjs', { tool_name: 'Bash', session_id: 'S1', agent_id: 'a1b2c3d4e5f6a7b8c', tool_input: { command: 'builds --run "./target/debug/probe.exe --frames 3" --out target/probe.txt' } });
  assert.equal(control.status, 0, 'the verb itself is not refused');
  assert.ok(existsSync(join(HOOKS, 'wait-poll.mjs')));
});
