// index-lock.mjs — ride out a briefly held `.git/index.lock` (KIT-T544). Another git process (a status
// refresh, an editor, a hand-driven writer) holds the lock for moments; a landing that fails on the
// first sight of it wastes a whole job. A lock that stays is reported with its path, age and the git
// processes alive, never removed.
//
// `retryOnIndexLock(run)` → run() while it fails on the lock, at most RETRIES more times;
//   `run` returns { code, err }. The final failure's `err` names the lock holder evidence.

import { statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const LOCKED = /Unable to create '([^']*index\.lock)': File exists/;
const RETRIES = 8;
const DELAY_MS = 1000;
const MS_PER_S = 1000;

const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function gitProcesses() {
  const r = process.platform === 'win32'
    ? spawnSync('tasklist', ['/FI', 'IMAGENAME eq git.exe', '/FO', 'CSV', '/NH'], { encoding: 'utf8', windowsHide: true })
    : spawnSync('pgrep', ['-x', 'git'], { encoding: 'utf8' });
  const pids = process.platform === 'win32'
    ? String(r.stdout || '').split(/\r?\n/).map((l) => /^"git.exe","(\d+)"/.exec(l)).filter(Boolean).map((m) => m[1])
    : String(r.stdout || '').split(/\s+/).filter(Boolean);
  return pids.length ? `git pids alive: ${pids.join(', ')}` : 'no git process alive';
}

function describe(lock) {
  let age = 'age unknown';
  try { age = `held ${Math.round((Date.now() - statSync(lock).mtimeMs) / MS_PER_S)} s`; } catch { /* the lock vanished after the last try */ }
  return `index.lock still present after ${RETRIES} retries: ${lock} (${age}; ${gitProcesses()})`;
}

export function retryOnIndexLock(run) {
  let r = run();
  for (let n = 0; n < RETRIES && r.code !== 0 && LOCKED.test(r.err); n++) {
    sleep(DELAY_MS);
    r = run();
  }
  const locked = r.code !== 0 && LOCKED.exec(r.err);
  return locked ? { ...r, err: `${r.err}\n${describe(locked[1])}` } : r;
}
