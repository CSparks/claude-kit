// orphan-verify (KIT-T834): a never-exited shell row is listed only while it can still be alive. A finished task
// notification or a command no process carries drops the row silently; a live process is named by pid and command line;
// a row that cannot be checked stays, flagged unverified.
// Run: node hooks/orphan-verify.test.mjs

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, reporter, tmpDir } from './test-harness.mjs';
import { orphanLines, orphanShells } from './orphan-shells.mjs';
import { finishedTasks, osProcesses, verifyOrphans } from './orphan-verify.mjs';

const { ok, done } = reporter('orphan-verify');
const MIN = 60000;
const AGE_MIN = 90;
const ANCIENT_MIN = 180;
const PROJECT = 'proj-x';
const SESSION = 'sess-1';
const LIVE_TOKEN = `live-orphan-token-${process.pid}-${Date.now()}`;
const LIVE_MS = 60000;
let child;

try {
  const tasks = tmpDir('kit-tasks-');
  const transcripts = tmpDir('kit-transcripts-');
  process.env.CLAUDE_KIT_TASKS_BASE = tasks;
  process.env.CLAUDE_KIT_TRANSCRIPTS_BASE = transcripts;
  const dir = join(tasks, PROJECT, SESSION, 'tasks');
  mkdirSync(dir, { recursive: true });
  mkdirSync(join(transcripts, PROJECT), { recursive: true });
  const shell = (id, ageMin = AGE_MIN) => {
    const f = join(dir, `${id}.output`);
    writeFileSync(f, 'working...\n');
    const t = (Date.now() - ageMin * MIN) / 1000;
    utimesSync(f, t, t);
  };
  for (const id of ['bfinished1', 'bdeadpid02', 'blivepid03', 'bnocmd0004', 'bsubagent5']) shell(id);
  shell('bancient006', ANCIENT_MIN);

  const use = (id, command) => JSON.stringify({ message: { content: [{ type: 'tool_use', id, name: 'Bash', input: { command, run_in_background: true } }] } });
  const result = (id, task) => JSON.stringify({ message: { content: [{ type: 'tool_result', tool_use_id: id, content: `Command running in background with ID: ${task}` }] } });
  const notification = (task, status) => JSON.stringify({ message: { content: `<task-notification>\n<task-id>${task}</task-id>\n<output-file>x</output-file>\n<status>${status}</status>\n</task-notification>` } });
  writeFileSync(join(transcripts, PROJECT, `${SESSION}.jsonl`), [
    use('t1', 'npm run publish:runtime'), result('t1', 'bfinished1'), notification('bfinished1', 'failed'),
    use('t2', 'node scripts/never-running-script.mjs --flag'), result('t2', 'bdeadpid02'),
    use('t3', `node -e "setTimeout(()=>{},${LIVE_MS})" ${LIVE_TOKEN}`), result('t3', 'blivepid03'),
  ].join('\n'));
  writeFileSync(join(dir, 'a0123456789abcdef.output'), [use('s1', 'node scripts/subagent-only-script.mjs'), result('s1', 'bsubagent5')].join('\n'));

  ok('finishedTasks reads completed / failed / killed notifications', finishedTasks(join(transcripts, PROJECT, `${SESSION}.jsonl`)).has('bfinished1'));

  const candidates = () => orphanShells({ project: PROJECT, minAgeMin: 30 }).filter((o) => o.id.startsWith('b'));
  ok('control: every never-exited file is a candidate before verification', candidates().length === 6);

  child = spawn(process.execPath, ['-e', `setTimeout(()=>{},${LIVE_MS})`, LIVE_TOKEN], { stdio: 'ignore', windowsHide: true });
  const rows = verifyOrphans(candidates(), { project: PROJECT });
  const byId = new Map(rows.map((r) => [r.id, r]));

  ok('a task the harness reported failed is dropped silently', !byId.has('bfinished1'));
  ok('a known command that no process carries is dropped silently', !byId.has('bdeadpid02'));
  ok('a live orphan is listed with its pid and command line', byId.get('blivepid03')?.pid === child.pid && byId.get('blivepid03').cmdline.includes(LIVE_TOKEN));
  ok('a command found only in a subagent transcript is checked too (no process: dropped)', !byId.has('bsubagent5'));
  ok('a row with no known command stays, flagged unverified, with its output file', byId.get('bnocmd0004')?.unverified === true);
  ok('negative control: an unverifiable row whose output has been silent for 2 h is presumed dead', !byId.has('bancient006'));
  const lines = orphanLines(rows);
  ok('the warning line names pid, session and command line of the live row, the output file of the unverified one',
    lines.some((l) => l.includes('blivepid03') && l.includes(`pid ${child.pid}`) && l.includes(`session ${SESSION}`)) && lines.some((l) => l.includes('bnocmd0004') && l.includes('unverified') && l.includes('bnocmd0004.output')));

  const injected = verifyOrphans(candidates(), { project: PROJECT, procs: () => [{ pid: 4242, ppid: 1, cmd: 'bash -c node scripts/subagent-only-script.mjs' }] });
  ok('negative control: with that process present the subagent shell is listed with its pid', injected.some((r) => r.id === 'bsubagent5' && r.pid === 4242));

  const unreadable = verifyOrphans(candidates(), { project: PROJECT, procs: () => null });
  ok('control: an unreadable process list fails open (rows stay, unverified) except the finished one', unreadable.length === 4 && unreadable.every((r) => r.unverified));

  ok('osProcesses reads this machine and finds the live child', (osProcesses() || []).some((p) => p.pid === child.pid));
} finally {
  if (child) child.kill();
  cleanup();
}
done();
