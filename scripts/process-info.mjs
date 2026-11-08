// process-info.mjs — what a live process is (KIT-T908).
//
//   processInfo(pid) -> { command, parentPid } for a live process; null when the scan finds nothing or cannot run
//     command    the process's full command line
//     parentPid  its parent process id, or null when the scan does not report one

import { spawnSync } from 'node:child_process';

const WIN_SCAN = (pid) => `$p = Get-CimInstance Win32_Process -Filter 'ProcessId=${Number(pid)}'; if ($p) { $p.ParentProcessId; $p.CommandLine }`;
const SCAN_OPTIONS = { encoding: 'utf8', windowsHide: true };

function scan(pid) {
  if (process.platform === 'win32') return spawnSync('powershell', ['-NoProfile', '-Command', WIN_SCAN(pid)], SCAN_OPTIONS);
  return spawnSync('ps', ['-o', 'ppid=', '-o', 'args=', '-p', String(Number(pid))], SCAN_OPTIONS);
}

export function processInfo(pid) {
  if (!Number.isInteger(pid)) return null;
  const r = scan(pid);
  if (r.status !== 0 || !r.stdout?.trim()) return null;
  if (process.platform === 'win32') {
    const [parent, ...rest] = r.stdout.trim().split(/\r?\n/);
    const command = rest.join(' ').trim();
    return command ? { command, parentPid: Number(parent) || null } : null;
  }
  const m = /^\s*(\d+)\s+(.+)$/.exec(r.stdout.trim());
  return m ? { command: m[2], parentPid: Number(m[1]) } : null;
}
