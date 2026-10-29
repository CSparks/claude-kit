// runaway.mjs — find and end processes a Bash-tool shell left spinning (KIT-T699, KIT-T697).
// A descendant of a Bash-tool shell (never the shell, never claude) older than MIN_AGE_MS is a runaway when
// it is a python reading stdin, or an interpreter/shell burning more than MIN_CPU_RATIO of a core over its
// life. Broker-owned processes and anything excluded under check-id `runaway-process` are never touched.
//
//   runawayRoots(table, { now?, skip? }) -> [{ pid, exe, reason, ageMin, ratio }]  top-most only
//   reapRunaways({ table?, kill?, fileBug?, skip?, now? }) -> { reaped, line }
//
// A claude process is never a root or a descendant (process-tree.mjs). Kit tickets are public and replayed
// into every session, so a filed bug names only the executable and the numbers, never the command line.

import { killTree, processTable, toolShells, descendantsOf, isClaude } from './process-tree.mjs';
import { isStdinPythonCommandLine } from './python-stdin.mjs';

export const CHECK_ID = 'runaway-process';
const MIN_AGE_MS = 5 * 60 * 1000;
const MIN_CPU_RATIO = 0.5;
const MS_PER_MIN = 60000;
const SPINNERS = /^(?:python|pythonw|py|bash|sh|zsh)(?:\d+(?:\.\d+)*)?(?:\.exe)?$/i;
const PYTHON = /^(?:python|pythonw|py)(?:\d+(?:\.\d+)*)?(?:\.exe)?$/i;
const EXE_TOKEN = /^[a-z0-9._-]+$/;
const UNKNOWN_EXE = 'unknown';
const BROKER = /broker\.mjs|scripts[\\/]broker[\\/]|target[\\/]broker/;

const exeName = (name) => {
  const base = String(name).toLowerCase().replace(/\.exe$/, '');
  return EXE_TOKEN.test(base) ? base : UNKNOWN_EXE;
};

function brokerOwned(table, proc) {
  const byPid = new Map(table.map((p) => [p.pid, p]));
  const seen = new Set();
  for (let cur = proc; cur && !seen.has(cur.pid); cur = byPid.get(cur.ppid)) {
    if (BROKER.test(cur.command || '')) return true;
    seen.add(cur.pid);
  }
  return false;
}

function verdict(proc, now) {
  const age = now - proc.startedMs;
  if (age < MIN_AGE_MS || isClaude(proc)) return null;
  const ratio = proc.cpuMs / age;
  if (PYTHON.test(proc.name) && isStdinPythonCommandLine(proc.command)) return { reason: 'stdin-python', ratio, age };
  if (SPINNERS.test(proc.name) && ratio > MIN_CPU_RATIO) return { reason: 'cpu', ratio, age };
  return null;
}

export function runawayRoots(table, { now = Date.now(), skip = () => false } = {}) {
  const flagged = new Map();
  for (const shell of toolShells(table)) {
    for (const proc of descendantsOf(table, shell.pid)) {
      const v = verdict(proc, now);
      if (v && !skip(proc) && !brokerOwned(table, proc)) flagged.set(proc.pid, { proc, ...v });
    }
  }
  const byPid = new Map(table.map((p) => [p.pid, p]));
  const hasFlaggedAncestor = (proc) => { for (let cur = byPid.get(proc.ppid); cur; cur = byPid.get(cur.ppid)) if (flagged.has(cur.pid)) return true; return false; };
  return [...flagged.values()].filter(({ proc }) => !hasFlaggedAncestor(proc))
    .map(({ proc, reason, ratio, age }) => ({ pid: proc.pid, exe: exeName(proc.name), reason, ageMin: Math.floor(age / MS_PER_MIN), ratio: Number(ratio.toFixed(2)) }));
}

async function fileKitBug(root) {
  const { fileKitBug: file } = await import('../../scripts/kit-bug.mjs');
  return file(root);
}

export async function reapRunaways({ table, kill, fileBug = fileKitBug, skip, now } = {}) {
  const procs = table || processTable();
  const reaped = [];
  for (const root of runawayRoots(procs, { now, skip })) {
    const ended = killTree(procs, root.pid, kill);
    if (!ended.length) continue;
    reaped.push({ ...root, ended });
    await fileBug({
      shape: `runaway-process:${root.reason}:${root.exe}`,
      title: `runaway ${root.exe} (${root.reason}) ended after ${root.ageMin} min`,
      detail: `${root.exe} pid ${root.pid}, ${root.ageMin} min old, cpu/age ${root.ratio}, reason ${root.reason}. The command line is not recorded: kit tickets are public.`,
      project: 'claude-kit',
    });
  }
  const names = [...new Set(reaped.map((r) => r.exe))].join('/');
  return { reaped, line: `runaway-process: ended ${reaped.length} runaway process tree(s)${names ? ` (${names})` : ''} left by Bash-tool shells` };
}
