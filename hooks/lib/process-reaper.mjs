// process-reaper.mjs — end the shell watchers a dead shell left behind (KIT-T697, KIT-T633, KIT-T634).
// A `tail -F log | grep …` pipeline, or a tree-wide `grep -r`, keeps running after the shell that
// started it exits, polling the disk until someone kills it. A process whose parent is gone cannot be
// anyone's live pipeline, so these are safe to end. A process whose parent is alive is never touched.
//
//   reapOrphans({ names?, list?, kill?, only? }) -> { reaped: [{ pid, name, command }], line }
//   orphansOf(procs, names)    -> the procs among `names` whose parent is dead
//   listProcesses(names)       -> [{ pid, ppid, name, started, command, parentDead? }]: the watchers (+ parents)
//
// A proc carrying `parentDead` is already decided. Otherwise a parent is dead when its pid is not in
// the table, or runs but started AFTER the child (a reused pid); POSIX also counts ppid 1 as dead.
// `only(proc)` narrows the reap (tests).

import { execFileSync } from 'node:child_process';

export const WATCHER_NAMES = ['tail', 'grep', 'egrep', 'fgrep', 'rg'];
const QUERY_TIMEOUT_MS = 60000;
const MS_PER_S = 1000;
const POSIX_ARGS_AT = 4;
const MSYS_ROOT_PPID = 1;
// ps -W columns: PID PPID PGID WINPID TTY UID STIME COMMAND; STIME is `hh:mm:ss` (one token) or `Mon dd` (two).
const STIME_AT = 6;
const stem = (name) => String(name).replace(/\.exe$/i, '').toLowerCase();
const baseName = (command) => stem(String(command).split(/[\\/]/).pop());
const wql = (field, values) => values.map((v) => `${field}=${v}`).join(' OR ');

// Git Bash's `ps -W` keeps the MSYS parent of every Git-usr-bin process, which Win32_Process hides behind
// short-lived fork stubs: a live `tail -F | grep` pipeline has dead Win32 parents but a live MSYS bash.
// A watcher whose MSYS parent pid is gone from the table is an orphan. One with no MSYS parent (ppid <= 1,
// started by a Windows program) falls back to its Win32 parent, via one CIM query.
function msysRows() {
  try {
    const out = execFileSync('ps', ['-W'], { encoding: 'utf8', timeout: QUERY_TIMEOUT_MS, windowsHide: true });
    return out.split(/\r?\n/).slice(1).filter(Boolean).map((l) => {
      const f = l.trim().split(/\s+/);
      const commandAt = STIME_AT + (f[STIME_AT]?.includes(':') ? 1 : 2);
      return { pid: Number(f[0]), ppid: Number(f[1]), winpid: Number(f[3]), command: f.slice(commandAt).join(' ') };
    });
  } catch { return []; }
}

const CIM_ROW = '"$($x.ProcessId)`t$($x.ParentProcessId)`t$($x.Name)`t$($x.CreationDate.ToFileTimeUtc())`t$($x.CommandLine)"';

function win32Table(winpids) {
  const script = [
    `$c = @(Get-CimInstance Win32_Process -Filter "${wql('ProcessId', winpids)}")`,
    '$ids = @($c | ForEach-Object { $_.ParentProcessId } | Sort-Object -Unique)',
    '$p = @(); if ($ids.Count) { $p = @(Get-CimInstance Win32_Process -Filter (($ids | ForEach-Object { "ProcessId=$_" }) -join " OR ")) }',
    `foreach ($x in $c + $p) { ${CIM_ROW} }`,
  ].join(';');
  const out = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', timeout: QUERY_TIMEOUT_MS, windowsHide: true });
  return out.split(/\r?\n/).filter(Boolean).map((l) => {
    const [pid, ppid, name, started, ...rest] = l.split('\t');
    return { pid: Number(pid), ppid: Number(ppid), name, started: Number(started), command: rest.join('\t') };
  });
}

function windowsProcesses(names) {
  const rows = msysRows();
  const live = new Set(rows.map((r) => r.pid));
  const watchers = rows.filter((r) => names.includes(baseName(r.command)));
  const rootless = watchers.filter((w) => w.ppid <= MSYS_ROOT_PPID);
  const decided = watchers.filter((w) => w.ppid > MSYS_ROOT_PPID)
    .map((w) => ({ pid: w.winpid, ppid: w.ppid, name: baseName(w.command), command: w.command, parentDead: !live.has(w.ppid) }));
  return rootless.length ? [...decided, ...win32Table(rootless.map((w) => w.winpid))] : decided;
}

function posixProcesses() {
  const out = execFileSync('ps', ['-eo', 'pid=,ppid=,etimes=,comm=,args='], { encoding: 'utf8', timeout: QUERY_TIMEOUT_MS });
  const now = Date.now();
  return out.split('\n').filter(Boolean).map((l) => {
    const f = l.trim().split(/\s+/);
    return { pid: Number(f[0]), ppid: Number(f[1]), started: now - Number(f[2]) * MS_PER_S, name: f[3], command: f.slice(POSIX_ARGS_AT).join(' ') };
  });
}

export const listProcesses = (names = WATCHER_NAMES) => (process.platform === 'win32' ? windowsProcesses(names) : posixProcesses());

export function orphansOf(procs, names = WATCHER_NAMES) {
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  const posix = process.platform !== 'win32';
  return procs.filter((p) => {
    if (!names.includes(stem(p.name)) || p.pid === process.pid) return false;
    if (typeof p.parentDead === 'boolean') return p.parentDead;
    if (posix && p.ppid === 1) return true;
    const parent = byPid.get(p.ppid);
    return !parent || parent.started > p.started;
  });
}

export function reapOrphans({ names = WATCHER_NAMES, list = () => listProcesses(names), kill = (pid) => process.kill(pid), only = () => true } = {}) {
  const reaped = [];
  try {
    for (const p of orphansOf(list(), names).filter(only)) {
      try { kill(p.pid); reaped.push({ pid: p.pid, name: stem(p.name), command: p.command }); } catch { /* already gone */ }
    }
  } catch { /* process table unreadable: reap nothing */ }
  const kinds = [...new Set(reaped.map((r) => r.name))].join('/');
  return { reaped, line: `orphan-reaper: ended ${reaped.length} orphaned shell watcher(s)${kinds ? ` (${kinds})` : ''} whose parent had exited` };
}
