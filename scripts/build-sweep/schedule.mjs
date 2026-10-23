// schedule.mjs — register / remove / probe the nightly build-sweep job (KIT-T636).
//
//   installSchedule(script)   -> { name, next }   Windows Task Scheduler (03:30) or a macOS launchd agent
//   uninstallSchedule()       -> boolean
//   isScheduled()             -> boolean          CLAUDE_KIT_SWEEP_SCHEDULED=1|0 overrides the probe
//
// Windows: a per-user task that starts when missed and on battery. macOS: ~/Library/LaunchAgents.

import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const TASK_NAME = 'claude-kit-build-sweep';
export const LAUNCHD_LABEL = 'com.claude-kit.build-sweep';
const RUN_HOUR = 3;
const RUN_MINUTE = 30;
const TIME_LIMIT_HOURS = 3;
const plistPath = () => join(homedir(), 'Library', 'LaunchAgents', `${LAUNCHD_LABEL}.plist`);

export const windowsRegisterScript = () => `
$action = New-ScheduledTaskAction -Execute $env:SWEEP_NODE -Argument ('"' + $env:SWEEP_SCRIPT + '"')
$trigger = New-ScheduledTaskTrigger -Daily -At '${String(RUN_HOUR).padStart(2, '0')}:${RUN_MINUTE}'
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours ${TIME_LIMIT_HOURS})
Register-ScheduledTask -TaskName '${TASK_NAME}' -Action $action -Trigger $trigger -Settings $settings -Force | Out-Null
(Get-ScheduledTaskInfo -TaskName '${TASK_NAME}').NextRunTime.ToString('s')
`;

export const launchdPlist = (node, script) => `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${LAUNCHD_LABEL}</string>
<key>ProgramArguments</key><array><string>${node}</string><string>${script}</string></array>
<key>StartCalendarInterval</key><dict><key>Hour</key><integer>${RUN_HOUR}</integer><key>Minute</key><integer>${RUN_MINUTE}</integer></dict>
</dict></plist>
`;

const powershell = (script, env) =>
  execFileSync('powershell', ['-NoProfile', '-Command', script], { encoding: 'utf8', env: { ...process.env, ...env } }).trim();

export function installSchedule(script) {
  if (process.platform === 'win32') {
    const next = powershell(windowsRegisterScript(), { SWEEP_NODE: process.execPath, SWEEP_SCRIPT: script });
    return { name: TASK_NAME, next };
  }
  if (process.platform === 'darwin') {
    const path = plistPath();
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, launchdPlist(process.execPath, script));
    execFileSync('launchctl', ['load', '-w', path]);
    return { name: LAUNCHD_LABEL, next: `daily ${RUN_HOUR}:${RUN_MINUTE}` };
  }
  throw new Error(`no scheduler support on ${process.platform}; run build-sweep.mjs from cron`);
}

export function uninstallSchedule() {
  if (process.platform === 'win32') {
    powershell(`Unregister-ScheduledTask -TaskName '${TASK_NAME}' -Confirm:$false -ErrorAction SilentlyContinue`, {});
    return true;
  }
  if (process.platform === 'darwin' && existsSync(plistPath())) {
    execFileSync('launchctl', ['unload', plistPath()]);
    rmSync(plistPath(), { force: true });
    return true;
  }
  return false;
}

export function isScheduled() {
  const forced = process.env.CLAUDE_KIT_SWEEP_SCHEDULED;
  if (forced !== undefined) return forced === '1';
  if (process.platform === 'win32') return spawnSync('schtasks', ['/Query', '/TN', TASK_NAME], { stdio: 'ignore' }).status === 0;
  if (process.platform === 'darwin') return existsSync(plistPath());
  return false;
}
