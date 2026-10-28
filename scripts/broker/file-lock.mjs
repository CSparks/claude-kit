// file-lock.mjs — a cargo command that fails "failed to remove file `<path>` … Access is denied
// (os error 5)" lost a race for a file another process still holds (a stray test-spawned exe, a
// scanner reading a fresh link). The failure is transient: run-cancellable.mjs retries after a
// back-off and records which process held the file (KIT-T675).
//
//   fileLockFailure(log)         -> the locked path, or null when the log holds no such failure
//   holdersOf(path, { run })     -> [{ pid, name, cmd }] processes running that executable ([] off Windows or when none)
//   lockNote(path, holders, n, of) -> the one-line log note for retry n of `of`
//   LOCK_BACKOFF_MS              waits before each retry; its length is the retry count

import { spawnSync } from 'node:child_process';

export const LOCK_BACKOFF_MS = [1000, 3000, 8000];
const REMOVE_DENIED = /failed to remove file `([^`]+)`[\s\S]{0,300}?Access is denied[^\n]*\(os error 5\)/i;
const PS_TIMEOUT_MS = 15000;

export const fileLockFailure = (log) => {
  const m = String(log).match(REMOVE_DENIED);
  return m ? m[1] : null;
};

const psQuote = (s) => `'${String(s).replace(/'/g, "''")}'`;

const queryProcesses = (path) => {
  const script = `Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -ieq ${psQuote(path)} } | ForEach-Object { "$($_.ProcessId)|$($_.Name)|$($_.CommandLine)" }`;
  const r = spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], { encoding: 'utf8', windowsHide: true, timeout: PS_TIMEOUT_MS });
  return r.status === 0 ? String(r.stdout) : '';
};

export function holdersOf(path, { run = queryProcesses } = {}) {
  if (process.platform !== 'win32' && run === queryProcesses) return [];
  try {
    return String(run(path)).split(/\r?\n/).filter(Boolean).map((line) => {
      const [pid, name, ...cmd] = line.split('|');
      return { pid: Number(pid), name, cmd: cmd.join('|').slice(0, 200) };
    });
  } catch { return []; }
}

export function lockNote(path, holders, n, of = LOCK_BACKOFF_MS.length) {
  const who = holders.length
    ? `held by ${holders.map((h) => `${h.name} (pid ${h.pid})`).join(', ')}`
    : 'no process runs that file (a scanner or a handle opened by a dead process)';
  return `file lock on ${path}: ${who}; retry ${n} of ${of}`;
}
