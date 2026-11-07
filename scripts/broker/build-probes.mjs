// build-probes.mjs — two machine facts the build budget reads while a build waits (KIT-D135).
//
//   commitFreeBytes()        -> free commit-limit memory in bytes, null where the OS gives none
//   gameRunning(patterns)    -> true while a process whose image name matches a pattern runs (a game or UAT session)
// Both are cached for PROBE_TTL_MS: a waiting build polls twice a second and a probe spawns a process.

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PROBE_TTL_MS = 5000;
const KIB = 1024;
const WINDOWS_COMMIT = '(Get-CimInstance Win32_OperatingSystem).FreeVirtualMemory';
const cache = new Map();

function cached(key, read) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < PROBE_TTL_MS) return hit.value;
  const value = read();
  cache.set(key, { at: Date.now(), value });
  return value;
}

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] });

function readCommitFree() {
  try {
    if (process.platform === 'win32') return Number(run('powershell', ['-NoProfile', '-Command', WINDOWS_COMMIT])) * KIB;
    const meminfo = readFileSync('/proc/meminfo', 'utf8');
    const kib = (key) => Number(new RegExp(`^${key}:\\s+(\\d+)`, 'm').exec(meminfo)?.[1]);
    const free = (kib('CommitLimit') - kib('Committed_AS')) * KIB;
    return Number.isFinite(free) ? free : null;
  } catch { return null; }
}

export const commitFreeBytes = () => (process.env.CLAUDE_KIT_COMMIT_FREE_BYTES ? Number(process.env.CLAUDE_KIT_COMMIT_FREE_BYTES) : cached('commit', readCommitFree));

function imageNames() {
  try {
    if (process.platform === 'win32') return run('tasklist', ['/fo', 'csv', '/nh']).split(/\r?\n/).map((l) => /^"([^"]+)"/.exec(l)?.[1]).filter(Boolean);
    return run('ps', ['-axo', 'comm=']).split('\n').map((l) => l.trim().split('/').pop());
  } catch { return []; }
}

export function gameRunning(patterns) {
  if (process.env.CLAUDE_KIT_GAME_RUNNING) return process.env.CLAUDE_KIT_GAME_RUNNING === '1';
  const res = patterns.map((p) => new RegExp(p, 'i'));
  if (!res.length) return false;
  return cached('names', imageNames).some((n) => res.some((re) => re.test(n.replace(/\.exe$/i, ''))));
}
