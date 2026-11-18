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
import { readFinished } from './finished-log.mjs';
import { launcherProblem, limitProblem } from '../../hooks/lib/builds-run-args.mjs';

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

test('a builds --run with no command prints the form, a worked example and the usual wrong turns (KIT-T1326)', () => {
  const r = spawnSync(process.execPath, [STATUS_CLI, '--run'], { cwd: checkout(), encoding: 'utf8' });
  assert.equal(r.status, 64);
  assert.match(r.stderr, /builds --run "<command>" --out <file> --timeout N --tool-timeout N/);
  assert.match(r.stderr, /example: builds --run "cd crates\/foo && cargo test -p foo 2>&1 \| tail -30" --out crates\/foo\/target\/test\.txt/);
  assert.match(r.stderr, /pipe and a redirect go INSIDE the quoted command/);
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
  const chained = gate('broker-wait-gate.mjs', { tool_name: 'Bash', session_id: 'S1', agent_id: 'a1b2c3d4e5f6a7b8c', tool_input: { command: 'builds --run "cargo test" --out target/t.txt; tail -F target/broker/finished.log', timeout: 350000 } });
  assert.equal(chained.status, 2);
  assert.match(chained.stderr, /ONE `builds --run/, 'the block names the one call (KIT-T1365)');
  assert.match(chained.stderr, /end your turn/);
  assert.match(chained.stderr, /wait\.mjs waits on broker jobs only/, 'and says wait.mjs is not the wait for a run id (KIT-T1366)');
  assert.match(chained.stderr, /Monitor/);
});

test('a raised limit carries its reason: on the record, in builds --result and in the finished.log line (KIT-T1377)', () => {
  const root = checkout();
  const record = startRun({ command: script(root, "console.log('compiling'); setTimeout(() => process.exit(0), 1500);"), cwd: root, root, limitS: 2400, why: 'full framework suite,\n approved' });
  assert.equal(record.why, 'full framework suite, approved');
  assert.match(describeRun(waitRun(root, record.id, { capS: 0 })), /limit 2400 s, raised: full framework suite, approved/);
  const ended = waitRun(root, record.id, { capS: 20 });
  assert.match(describeRun(ended), /ended with exit 0 after \d+ s \(limit 2400 s, raised: full framework suite, approved\)/);
  assert.match(finishedLog(root), new RegExp(`${record.id} exit0 agent=- ticket=- limit=2400 why=full framework suite, approved\\n`));
  const parsed = readFinished(join(root, 'target', 'broker')).find((f) => f.job === record.id);
  assert.equal(parsed.limitS, 2400);
  assert.equal(parsed.why, 'full framework suite, approved');
  const plain = startRun({ command: script(root, 'process.exit(0);'), cwd: root, root });
  waitRun(root, plain.id, { capS: 20 });
  assert.match(finishedLog(root), new RegExp(`${plain.id} exit0 agent=- ticket=-\\n`), 'a default run adds no limit field');
});

test('the launcher and the gate refuse a raise with no reason or past the ceiling, and accept a named one (KIT-T1377)', () => {
  const root = checkout();
  const cli = (...args) => spawnSync(process.execPath, [STATUS_CLI, '--run', script(root, 'process.exit(0);'), ...args, '--timeout', '20', '--tool-timeout', '60'], { cwd: root, encoding: 'utf8' });
  const bare = cli('--limit', '3000');
  assert.equal(bare.status, 64);
  assert.match(bare.stderr, /--limit 3000 raises the 1200 s default: add --why "<reason>"/);
  assert.match(cli('--limit', '9000', '--why', 'x').stderr, /over the 7200 s ceiling/);
  const named = cli('--limit', '3000', '--why', 'approved full suite');
  assert.equal(named.status, 0, named.stderr);
  assert.match(named.stdout, /limit 3000 s, raised: approved full suite/);
  const run = (...tokens) => launcherProblem(['builds', '--run', '"cargo test --workspace"', '--out', 'target/t.txt', ...tokens], root);
  assert.equal(run('--limit', '600'), '', 'a limit under the default needs no reason');
  assert.match(run('--limit', '3600'), /add --why/);
  assert.equal(run('--limit', '3600', '--why', '"full suite, approved 2026-11-18"'), '');
  assert.match(run('--limit', '7201', '--why', '"x"'), /ceiling/);
  assert.match(run('--why', '"x"'), /only for a --limit above the default/);
  assert.equal(limitProblem(undefined, ''), '');
});

const WAIT_CLI = fileURLToPath(new URL('./wait.mjs', import.meta.url));
const waitCli = (root, id) => spawnSync(process.execPath, [WAIT_CLI, id, '--root', root, '--timeout', '30'], { cwd: root, encoding: 'utf8', env: { ...process.env, BROKER_NO_AUTOSTART: '1' } });

test('wait.mjs on a builds --run id reads the record once instead of answering unknown job (KIT-T1366)', () => {
  const root = checkout();
  const done = startRun({ command: script(root, "console.log('frame'); process.exit(0);"), cwd: root, root });
  waitRun(root, done.id, { capS: 20 });
  const ended = waitCli(root, done.id);
  assert.equal(ended.status, 0, ended.stdout + ended.stderr);
  assert.match(ended.stdout, /ended with exit 0/);
  const failed = startRun({ command: script(root, 'process.exit(4);'), cwd: root, root });
  waitRun(root, failed.id, { capS: 20 });
  assert.equal(waitCli(root, failed.id).status, 1, 'an ended run with a failing exit reads as not ok');
  const long = startRun({ command: script(root, 'setTimeout(() => {}, 5000);'), cwd: root, root });
  const began = Date.now();
  const running = waitCli(root, long.id);
  assert.equal(running.status, 2);
  assert.ok(Date.now() - began < 4000, 'a running run is read once, never waited on');
  assert.match(running.stdout, /does not wait on a run/);
  assert.match(running.stdout, new RegExp(`wait: ${long.id} STILL RUNNING \\(exit 2\\)`));
  assert.equal(waitCli(root, 'run-00000000000000-none').status, 3, 'control: an id that names nothing is still unknown');
});
