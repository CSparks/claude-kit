// launch.mjs — start a broker daemon that belongs to no caller (KIT-T496). wait/submit run inside
// a worker's Bash shell; a daemon spawned there is that shell's child, with nowhere to log, and
// can die with it. On Windows the daemon is created by the WMI service (Win32_Process.Create,
// hidden window), so it sits outside the caller's process tree and job object; elsewhere it is a
// detached session leader. Either way it gets `--log auto`: its own log under target/broker/logs.
//
// `launchDaemon(brokerScript, root, args, { run })` → { ok, how, error? }; `run(file, argv)` is
//   injectable (tests) and defaults to spawnSync.
// `wmiCommand(commandLine, cwd)` → the PowerShell script that creates the process.

import { spawn, spawnSync } from 'node:child_process';

const SW_HIDE = 0;
const quote = (s) => `"${String(s).replace(/"/g, '\\"')}"`;
const psString = (s) => `'${String(s).replace(/'/g, "''")}'`;

export function wmiCommand(commandLine, cwd) {
  return [
    `$si = New-CimInstance -ClassName Win32_ProcessStartup -ClientOnly -Property @{ ShowWindow = [uint16]${SW_HIDE} }`,
    `$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = ${psString(commandLine)}; CurrentDirectory = ${psString(cwd)}; ProcessStartupInformation = $si }`,
    'if ($r.ReturnValue -ne 0) { exit [int]$r.ReturnValue }',
    'Write-Output $r.ProcessId',
  ].join('; ');
}

const defaultRun = (file, argv) => spawnSync(file, argv, { encoding: 'utf8', windowsHide: true });

export function launchDaemon(brokerScript, root, args = [], { run = defaultRun, platform = process.platform } = {}) {
  const argv = [brokerScript, '--root', root, ...args, '--log', 'auto'];
  if (platform === 'win32') {
    const commandLine = [process.execPath, ...argv].map(quote).join(' ');
    const r = run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', wmiCommand(commandLine, root)]);
    if (r.status === 0) return { ok: true, how: 'wmi', pid: Number(String(r.stdout || '').trim()) || null };
    return { ok: false, how: 'wmi', error: `Win32_Process.Create failed (exit ${r.status}): ${String(r.stderr || '').trim().slice(0, 200)}` };
  }
  const child = spawn(process.execPath, argv, { cwd: root, detached: true, stdio: 'ignore' });
  child.unref();
  return { ok: true, how: 'detached', pid: child.pid };
}
