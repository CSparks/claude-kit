// build-guard.mjs — what a cargo build does after it holds its build slot and before it spawns (KIT-T767, KIT-T769):
// takes the target dir's mutex, so two builds on different source never interleave their freshness records, and aligns the
// tree's source mtimes with the target dir's last build (content-align.mjs).
//
//   enterBuild(cmd, { cwd, targetDir, shouldCancel, force, pollMs }) -> { cancelled, touched, release() }
//   A command that is not cargo build-shaped (and not `force`) gets a no-op guard. release() is idempotent.

import { mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { hostname } from 'node:os';
import { join } from 'node:path';
import { isCargoBuild } from './cargo-subs.mjs';
import { alignSources } from './content-align.mjs';
import { pulse } from './stall.mjs';

const POLL_MS = 250;
const UNWRITTEN_MS = 5000;
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const NO_GUARD = { cancelled: false, touched: 0, release() {} };

const alive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (e) { return !!e && e.code === 'EPERM'; }
};

function holderAlive(file) {
  try {
    const held = JSON.parse(readFileSync(file, 'utf8'));
    return held.host !== hostname() || alive(held.pid);
  } catch {
    try { return Date.now() - statSync(file).mtimeMs < UNWRITTEN_MS; } catch { return false; }
  }
}

export function enterBuild(cmd, { cwd, targetDir, shouldCancel = () => false, force = false, pollMs = POLL_MS } = {}) {
  if (!targetDir || (!force && !isCargoBuild(cmd))) return NO_GUARD;
  const file = join(targetDir, 'broker', 'content', 'build.lock');
  try { mkdirSync(join(file, '..'), { recursive: true }); } catch { return { ...NO_GUARD, ...alignSources(cwd, targetDir) }; }
  for (;;) {
    try {
      writeFileSync(file, JSON.stringify({ pid: process.pid, host: hostname() }), { flag: 'wx' });
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') return { ...NO_GUARD, ...alignSources(cwd, targetDir) };
      if (!holderAlive(file)) { rmSync(file, { force: true }); continue; }
      if (shouldCancel()) return { ...NO_GUARD, cancelled: true };
      pulse();
      sleep(pollMs);
    }
  }
  const { touched } = alignSources(cwd, targetDir);
  let held = true;
  return { cancelled: false, touched, release() { if (held) rmSync(file, { force: true }); held = false; } };
}
