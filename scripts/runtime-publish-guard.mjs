// runtime-publish-guard.mjs — what keeps one publish from damaging another (KIT-T737).
//
//   withPublishLock(runtimeRoot, fn) -> fn()'s result; one publish per runtime directory: a live holder
//     makes this call throw naming its pid, a dead holder's lock is taken over, and the lock is released
//     when fn returns or throws
//   stopProcessesUnder(dir | dirs)   -> one process scan stops every process whose command line names a directory (a q-server a
//     test run left in an export), so the export can be deleted
//   gitOrThrow(dir, args)            -> runs git in `dir`; a failure throws with git's own stderr
//   CHILD_OPTIONS                    -> spawn options every publish child takes: windowsHide gives the child a console of its
//     own, so it survives the harness detaching the parent's console (exit 3221225794, 0xC0000142)
//   sweepScratch(parent, { isAlive }) -> removes the `.kit-verify-<sha>-<pid>` copies in `parent` whose publish is dead;
//     returns the names removed

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const LOCK = 'publish.lock';
const TAKEOVER_ATTEMPTS = 2;
const STDERR_SHOWN = 600;
const SCRATCH = /^\.kit-verify-[0-9a-f]+-(\d+)$/;
const SCRATCH_RM_RETRIES = 10;
const SCRATCH_RM_DELAY_MS = 300;

export const CHILD_OPTIONS = { windowsHide: true };

export const alive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
};

export function sweepScratch(parent, { isAlive = alive } = {}) {
  if (!existsSync(parent)) return [];
  const dead = readdirSync(parent).filter((name) => {
    const m = SCRATCH.exec(name);
    return m && !isAlive(Number(m[1]));
  });
  if (!dead.length) return [];
  stopProcessesUnder(dead.map((name) => join(parent, name)));
  const removed = [];
  for (const name of dead) {
    try {
      rmSync(join(parent, name), { recursive: true, force: true, maxRetries: SCRATCH_RM_RETRIES, retryDelay: SCRATCH_RM_DELAY_MS });
      removed.push(name);
    } catch { /* a copy still held is swept on the next run */ }
  }
  return removed;
}

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

const psQuoted = (dir) => `'${String(dir).replace(/'/g, "''")}'`;
const WIN_STOP = (dirs) => `$ds = @(${dirs.map(psQuoted).join(', ')}); Get-CimInstance Win32_Process | Where-Object { $c = $_.CommandLine; $_.ProcessId -ne ${process.pid} -and $_.ProcessId -ne $PID -and $c -and ($ds | Where-Object { $c.IndexOf($_, [StringComparison]::OrdinalIgnoreCase) -ge 0 }) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`;

export function stopProcessesUnder(dirOrDirs) {
  const dirs = [dirOrDirs].flat();
  if (process.platform === 'win32') spawnSync('powershell', ['-NoProfile', '-Command', WIN_STOP(dirs)], { stdio: 'ignore', ...CHILD_OPTIONS });
  else for (const dir of dirs) spawnSync('pkill', ['-f', dir], { stdio: 'ignore' });
}

export function gitOrThrow(dir, args) {
  const r = spawnSync('git', ['-c', 'user.email=publish@kit', '-c', 'user.name=publish', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args], { cwd: dir, encoding: 'utf8', ...CHILD_OPTIONS });
  if (r.status !== 0) throw new Error(`git ${args[0]} failed in ${dir} (exit ${r.status ?? r.error?.message}): ${String(r.stderr || r.stdout || '').trim().slice(0, STDERR_SHOWN)}`);
  return r.stdout;
}
