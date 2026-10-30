// runtime-publish-guard.mjs — what keeps one publish from damaging another (KIT-T737).
//
//   withPublishLock(runtimeRoot, fn) -> fn()'s result; one publish per runtime directory: a live holder
//     makes this call throw naming its pid, a dead holder's lock is taken over, and the lock is released
//     when fn returns or throws
//   stopProcessesUnder(dir)          -> stops every process whose command line names `dir` (a q-server a
//     test run left in an export), so the export can be deleted
//   gitOrThrow(dir, args)            -> runs git in `dir`; a failure throws with git's own stderr

import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const LOCK = 'publish.lock';
const TAKEOVER_ATTEMPTS = 2;
const STDERR_SHOWN = 600;

const alive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
};

const holderOf = (path) => {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
};

export function withPublishLock(runtimeRoot, fn) {
  mkdirSync(runtimeRoot, { recursive: true });
  const path = join(runtimeRoot, LOCK);
  let taken = false;
  for (let attempt = 0; attempt < TAKEOVER_ATTEMPTS && !taken; attempt++) {
    try {
      writeFileSync(path, JSON.stringify({ pid: process.pid, host: hostname(), since: new Date().toISOString() }), { flag: 'wx' });
      taken = true;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const holder = holderOf(path);
      if (holder && holder.host === hostname() && Number.isInteger(holder.pid) && alive(holder.pid)) {
        throw new Error(`another publish holds ${path} (pid ${holder.pid}, since ${holder.since}); wait for it to finish`);
      }
      rmSync(path, { force: true });
    }
  }
  if (!taken) throw new Error(`could not take ${path}`);
  try {
    return fn();
  } finally {
    rmSync(path, { force: true });
  }
}

const WIN_STOP = (dir) => `$d = ${JSON.stringify(dir)}; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne ${process.pid} -and $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.IndexOf($d, [StringComparison]::OrdinalIgnoreCase) -ge 0 } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;

export function stopProcessesUnder(dir) {
  if (process.platform === 'win32') spawnSync('powershell', ['-NoProfile', '-Command', WIN_STOP(dir)], { stdio: 'ignore' });
  else spawnSync('pkill', ['-f', dir], { stdio: 'ignore' });
}

export function gitOrThrow(dir, args) {
  const r = spawnSync('git', ['-c', 'user.email=publish@kit', '-c', 'user.name=publish', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd: dir, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args[0]} failed in ${dir} (exit ${r.status ?? r.error?.message}): ${String(r.stderr || r.stdout || '').trim().slice(0, STDERR_SHOWN)}`);
  return r.stdout;
}
