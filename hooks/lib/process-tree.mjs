// process-tree.mjs — the process table and the Bash-tool shell subtrees in it (KIT-T699).
//   processTable()               -> [{ pid, ppid, name, startedMs, cpuMs, command }]
//   toolShells(table)            -> bash/sh/zsh sourcing a `shell-snapshots/snapshot-bash-` file, never claude
//   descendantsOf(table, pid)    -> every process below `pid`, never entering a claude process
//   hasClaudeAncestor(table, pid), killTree(table, pid, kill?) -> pids ended (taskkill /T /F, or SIGKILL leaf-first)
// A claude process is never a root, never a descendant, never killed: ending one ends a live session.

import { execFileSync } from 'node:child_process';

const QUERY_TIMEOUT_MS = 40000;
const MS_PER_S = 1000;
const FILETIME_PER_MS = 10000;
const FILETIME_EPOCH_MS = 11644473600000;
const SECONDS_PER_UNIT = [1, 60, 3600];
const SECONDS_PER_DAY = 86400;
const SHELL_NAME = /^(?:bash|sh|zsh)(?:\.exe)?$/i;
const CLAUDE_NAME = /^claude(?:\.exe)?$/i;
const SNAPSHOT = /shell-snapshots[\\/]snapshot-bash-/;
const WIN_ROW = '"$($x.ProcessId)`t$($x.ParentProcessId)`t$($x.Name)`t$($x.CreationDate.ToFileTimeUtc())`t$($x.UserModeTime + $x.KernelModeTime)`t$($x.CommandLine)"';

export const isClaude = (p) => CLAUDE_NAME.test(p.name || '');

function windowsTable() {
  const script = `foreach ($x in Get-CimInstance Win32_Process) { ${WIN_ROW} }`;
  const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: QUERY_TIMEOUT_MS, windowsHide: true });
  return out.split(/\r?\n/).filter(Boolean).map((l) => {
    const [pid, ppid, name, created, cpu, ...rest] = l.split('\t');
    return { pid: Number(pid), ppid: Number(ppid), name, startedMs: Number(created) / FILETIME_PER_MS - FILETIME_EPOCH_MS, cpuMs: Number(cpu) / FILETIME_PER_MS, command: rest.join('\t') };
  });
}

// ps `[[dd-]hh:]mm:ss` (etime, time) -> seconds
const seconds = (text) => {
  const [days, clock] = text.includes('-') ? text.split('-') : [0, text];
  const parts = clock.split(':').map(Number).reverse();
  return Number(days) * SECONDS_PER_DAY + parts.reduce((sum, v, i) => sum + v * SECONDS_PER_UNIT[i], 0);
};

function posixTable() {
  const out = execFileSync('ps', ['-eo', 'pid=,ppid=,etime=,time=,comm=,args='], { encoding: 'utf8', timeout: QUERY_TIMEOUT_MS });
  const now = Date.now();
  return out.split('\n').filter(Boolean).map((l) => {
    const [pid, ppid, etime, time, name, ...args] = l.trim().split(/\s+/);
    return { pid: Number(pid), ppid: Number(ppid), startedMs: now - seconds(etime) * MS_PER_S, cpuMs: seconds(time) * MS_PER_S, name, command: args.join(' ') };
  });
}

export const processTable = () => (process.platform === 'win32' ? windowsTable() : posixTable());

export const toolShells = (table) => table.filter((p) => SHELL_NAME.test(p.name || '') && !isClaude(p) && SNAPSHOT.test(p.command || ''));

export function descendantsOf(table, pid) {
  const out = [];
  const walk = (parent) => {
    for (const child of table.filter((p) => p.ppid === parent)) {
      if (isClaude(child) || out.includes(child)) continue;
      out.push(child);
      walk(child.pid);
    }
  };
  walk(pid);
  return out;
}

export function hasClaudeAncestor(table, pid) {
  const byPid = new Map(table.map((p) => [p.pid, p]));
  const seen = new Set();
  for (let cur = byPid.get(byPid.get(pid)?.ppid); cur && !seen.has(cur.pid); cur = byPid.get(cur.ppid)) {
    if (isClaude(cur)) return true;
    seen.add(cur.pid);
  }
  return false;
}

function systemKill(pid) {
  if (process.platform === 'win32') execFileSync('taskkill', ['/T', '/F', '/PID', String(pid)], { stdio: 'ignore', windowsHide: true });
  else process.kill(pid, 'SIGKILL');
}

export function killTree(table, pid, kill = systemKill) {
  const root = table.find((p) => p.pid === pid);
  if (!root || isClaude(root) || pid === process.pid) return [];
  const below = descendantsOf(table, pid).filter((p) => p.pid !== process.pid).reverse();
  const ended = [];
  for (const p of [...below, root]) {
    try { kill(p.pid); ended.push(p.pid); } catch { /* already gone */ }
  }
  return ended;
}
