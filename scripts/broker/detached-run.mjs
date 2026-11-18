// detached-run.mjs — `builds --run` and `builds --result` (KIT-T1283): run a long command ONCE, in a process that outlives the
// agent's turn, and learn its end without sleeping or polling. A subagent's background children die with it and the no-wait gate
// (hooks/broker-wait-gate.mjs, KIT-D115) refuses sleeps and polls, yet a probe capture or census takes 2 to 6 minutes, longer than
// one foreground call. The launcher starts a detached worker (its own parent exits at once, so the harness's process-tree kill of
// the agent's shells finds nothing), may wait ONCE in the same call (the window of `builds --wait`), and otherwise returns the id:
// the end is one line in <target>/broker/finished.log (the orchestrator's Monitor, finished-log.mjs) and `builds --result <id>`
// reads the record once.
//
//   builds --run "<command>" [--out <file>] [--limit <s>] [--timeout <s> --tool-timeout <s>]
//       the command runs in the directory the call starts in (the project root); the source-shell gate accepts only this
//       surface: --out under target/ or the scratchpad, numbers for the three time flags, no other flag (a --cwd is refused:
//       put a `cd <dir> &&` inside the quoted command instead)
//       exit = the command's exit when it ended inside the wait window; 2 when it still runs (id, out file and how to resume named)
//   builds --result <id>      one read of the record: running, or ended with its exit and the tail of the output
//
//   startRun({ command, cwd, out, writer, limitS, root }) -> record     the record written, the worker spawned detached
//   readRun(root, id)                                      -> record | null
//   waitRun(root, id, { capS, pollMs, now, sleep })        -> record     the record once ended, or when capS passes
//   describeRun(record, tailLines?)                        -> text for the caller
//   runCli(argv)                                           -> exit code, printing the outcome
// The worker is this file run with `--worker <record path>`; the command runs through bash -c (sh, then cmd.exe) with
// bin/build-shims first on PATH, so a cargo call inside it takes cores from the machine budget like any other.

import { execFileSync, spawn } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LAUNCHER_EXAMPLE, LAUNCHER_NOTES, LAUNCHER_USAGE } from '../../hooks/lib/builds-run-usage.mjs';
import { parseFlags } from './cli.mjs';
import { recordFinished } from './finished-log.mjs';
import { waitWindow } from './wait-limits.mjs';

const SELF = fileURLToPath(import.meta.url);
const SHIM_DIR = resolve(dirname(SELF), '..', '..', 'bin', 'build-shims');
const WRITER_ENV = 'CLAUDE_KIT_BUILD_WRITER';
const DEFAULT_LIMIT_S = 1200;
const POLL_MS = 500;
const MS_PER_SECOND = 1000;
const TAIL_LINES = 30;
const EXIT = { ENDED_OK: 0, RUNNING: 2, USAGE: 64 };
export const RUN_STATUS = { RUNNING: 'running', ENDED: 'ended', TIMEOUT: 'timeout' };
const STATUS = RUN_STATUS;
const sleepMs = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

const runsDir = (root) => join(root, 'target', 'broker', 'runs');
const recordPath = (root, id) => join(runsDir(root), `${id}.json`);
const writeRecord = (path, record) => writeFileSync(path, JSON.stringify(record));

function repoRoot(cwd) {
  try { return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return cwd; }
}

export const readRun = (root, id) => { try { return JSON.parse(readFileSync(recordPath(root, id), 'utf8')); } catch { return null; } };

export function startRun({ command, cwd = process.cwd(), out = '', writer = '', limitS = DEFAULT_LIMIT_S, root = repoRoot(cwd) }) {
  mkdirSync(runsDir(root), { recursive: true });
  const id = `run-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`;
  const logFile = out ? resolve(cwd, out) : join(runsDir(root), `${id}.log`);
  mkdirSync(dirname(logFile), { recursive: true });
  const record = { id, command, cwd: resolve(cwd), root, out: logFile, writer, limitS, status: STATUS.RUNNING, startedAt: new Date().toISOString() };
  writeRecord(recordPath(root, id), record);
  const worker = spawn(process.execPath, [SELF, '--worker', recordPath(root, id)], { detached: true, stdio: 'ignore', windowsHide: true, env: process.env });
  worker.unref();
  return record;
}

export function waitRun(root, id, { capS, pollMs = POLL_MS, now = Date.now, sleep = sleepMs } = {}) {
  const begun = now();
  for (;;) {
    const record = readRun(root, id);
    if (!record || record.status !== STATUS.RUNNING || now() - begun >= capS * MS_PER_SECOND) return record;
    sleep(pollMs);
  }
}

const tailOf = (file, lines) => { try { return readFileSync(file, 'utf8').split(/\r?\n/).filter((l, i, all) => l || i < all.length - 1).slice(-lines).join('\n'); } catch { return ''; } };
const seconds = (a, b) => Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / MS_PER_SECOND));

export function describeRun(record, tailLines = TAIL_LINES) {
  if (!record) return 'builds --result: no such run record';
  const head = `run ${record.id}: ${record.command}`;
  if (record.status === STATUS.RUNNING) {
    return [head, `  still running since ${record.startedAt.slice(11, 19)}Z (${seconds(record.startedAt, new Date().toISOString())} s, limit ${record.limitS} s)`, `  output: ${record.out}`,
      `  its end is one line in ${join(record.root, 'target', 'broker', 'finished.log')} (${record.id} exit<N>|timeout); read it once with \`builds --result ${record.id}\`.`,
      '  Do not sleep or poll: write your handoff naming this id and the output file, and end; the orchestrator resumes you from that line.'].join('\n');
  }
  const verdict = record.status === STATUS.TIMEOUT ? `stopped at its ${record.limitS} s limit` : `ended with exit ${record.exit}`;
  return [head, `  ${verdict} after ${seconds(record.startedAt, record.endedAt)} s`, `  output: ${record.out}`, tailOf(record.out, tailLines)].join('\n');
}

function shellFor(command) {
  if (process.platform !== 'win32') return ['sh', ['-c', command]];
  for (const shell of ['bash', 'sh']) {
    try { execFileSync(shell, ['-c', 'exit 0'], { stdio: 'ignore', windowsHide: true }); return [shell, ['-c', command]]; } catch { /* next */ }
  }
  return ['cmd.exe', ['/d', '/s', '/c', command]];
}

function killTree(pid) {
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    else process.kill(pid, 'SIGKILL');
  } catch { /* already gone */ }
}

// The worker: one command, its output to the record's file, its end written to the record and to finished.log.
async function work(path) {
  const record = JSON.parse(readFileSync(path, 'utf8'));
  const fd = openSync(record.out, 'w');
  const [file, args] = shellFor(record.command);
  const env = { ...process.env, PATH: `${SHIM_DIR}${delimiter}${process.env.PATH || ''}`, ...(record.writer ? { [WRITER_ENV]: record.writer } : {}) };
  const child = spawn(file, args, { cwd: record.cwd, stdio: ['ignore', fd, fd], env, windowsHide: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; killTree(child.pid); }, record.limitS * MS_PER_SECOND);
  const end = (exit) => {
    clearTimeout(timer);
    closeSync(fd);
    const ended = { ...record, status: timedOut ? STATUS.TIMEOUT : STATUS.ENDED, exit, endedAt: new Date().toISOString(), pid: child.pid };
    writeRecord(path, ended);
    const agent = String(record.writer || '').split('|')[1] || '-';
    recordFinished({ targetDir: join(record.root, 'target') }, { id: record.id, status: timedOut ? STATUS.TIMEOUT : `exit${exit}`, agent });
  };
  child.on('error', () => end(EXIT.USAGE));
  child.on('exit', (code) => end(code ?? EXIT.USAGE));
}

export async function runCli(argv) {
  const flags = parseFlags(argv);
  const subagent = true;
  if (typeof flags.result === 'string') {
    const record = readRun(repoRoot(process.cwd()), flags.result);
    console.log(describeRun(record));
    return record ? (record.status === STATUS.RUNNING ? EXIT.RUNNING : record.exit ?? EXIT.ENDED_OK) : EXIT.USAGE;
  }
  if (typeof flags.run !== 'string') {
    console.error(`builds --run: a command is required.\n  form:    ${LAUNCHER_USAGE} [--limit <s>]\n  example: ${LAUNCHER_EXAMPLE}\n  ${LAUNCHER_NOTES.join('\n  ')}`);
    return EXIT.USAGE;
  }
  const record = startRun({ command: flags.run, cwd: process.cwd(), out: typeof flags.out === 'string' ? flags.out : '', writer: process.env[WRITER_ENV] || '', limitS: Number(flags.limit) || DEFAULT_LIMIT_S });
  const waited = waitRun(record.root, record.id, { capS: waitWindow(flags, { subagent }).seconds });
  console.log(describeRun(waited));
  return waited.status === STATUS.RUNNING ? EXIT.RUNNING : waited.exit ?? EXIT.ENDED_OK;
}

if (process.argv[2] === '--worker' && existsSync(process.argv[3] || '')) await work(process.argv[3]);
