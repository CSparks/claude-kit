// guard.mjs — decide whether a repo's build dirs are in use right now (KIT-T636).
//
//   processSnapshot(list?) -> { commands: [lowercased cargo/rustc command lines] }
//   skipReason(repoDir, builds, snapshot, root, alive?) -> string | null
//
// A cargo/rustc process whose command line names no path under the scan root has an unknown
// owner, so it defers every repo. A live target/broker/broker.lock (pid alive on this host)
// defers the repo that owns it.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join, sep } from 'node:path';
import { pidAlive } from '../broker/lock.mjs';

const CARGO_PROCESS = /^(cargo|rustc|rustdoc|clippy-driver)(\.exe)?$/i;
const WINDOWS_LIST = [
  '-NoProfile', '-Command',
  "Get-CimInstance Win32_Process | Where-Object { $_.Name -match '^(cargo|rustc|rustdoc|clippy-driver)\.exe$' } | ForEach-Object { $_.CommandLine }",
];
const norm = (p) => String(p).split(sep).join('/').toLowerCase();

function systemCommands() {
  try {
    if (process.platform === 'win32') {
      return execFileSync('powershell', WINDOWS_LIST, { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
    }
    const ps = execFileSync('ps', ['-axo', 'comm=,args='], { encoding: 'utf8' });
    return ps.split('\n').filter((l) => CARGO_PROCESS.test(l.trim().split(/\s+/)[0].split('/').pop()));
  } catch {
    return [];
  }
}

export function processSnapshot(list = systemCommands) {
  return { commands: list().map(norm) };
}

function lockLive(buildDir) {
  const lock = join(buildDir, 'broker', 'broker.lock');
  if (!existsSync(lock)) return false;
  try {
    const held = JSON.parse(readFileSync(lock, 'utf8'));
    return held.host !== hostname() || pidAlive(held.pid);
  } catch {
    return false;
  }
}

export function skipReason(repoDir, builds, snapshot, root) {
  const rootKey = norm(root);
  const repoKey = norm(repoDir);
  if (snapshot.commands.some((c) => !c.includes(rootKey))) return 'cargo/rustc running with an unknown owner';
  if (snapshot.commands.some((c) => c.includes(repoKey))) return 'cargo/rustc running against it';
  const dirs = builds.flatMap(function flat(b) { return [b.dir, ...b.lanes.flatMap(flat)]; });
  if (dirs.some(lockLive)) return 'live broker lock';
  return null;
}
