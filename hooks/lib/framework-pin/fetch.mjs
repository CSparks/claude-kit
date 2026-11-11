// framework-pin/fetch.mjs — a bounded, throttled fetch of the submodule's origin main (KIT-D141).
// Never throws and never blocks past FETCH_TIMEOUT_MS; the only writes are git's own refs, objects and FETCH_HEAD,
// and the throttle stamp (written on success only, so an unreachable remote is retried and reported each session).
//
//   fetchOrigin(subCwd, { skip }) -> { attempted, ok, reason, refAgeMs }
//     reason   first line of git's error, or 'timed out'; '' when ok or skipped
//     refAgeMs age of the last fetch git recorded in the submodule (FETCH_HEAD), null when it never fetched

import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { git } from '../exec.mjs';
import { fetchDue, stampFetch } from '../git-state.mjs';

const FETCH_TIMEOUT_MS = 4000;
const FETCH_ENV = { GIT_TERMINAL_PROMPT: '0', GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o ConnectTimeout=3' };
const stampKey = (subCwd) => `${subCwd}#framework-pin`;

function refAgeMs(subCwd) {
  const gitDir = git(['rev-parse', '--absolute-git-dir'], subCwd).trim();
  try {
    return Date.now() - statSync(join(gitDir, 'FETCH_HEAD')).mtimeMs;
  } catch {
    return null;
  }
}

const reasonOf = (e) => (e && (e.code === 'ETIMEDOUT' || e.killed)
  ? 'timed out'
  : String((e && e.stderr) || (e && e.message) || 'git fetch failed').split('\n').find((l) => l.trim())?.trim() || 'git fetch failed');

export function fetchOrigin(subCwd, { skip = false } = {}) {
  if (skip || !fetchDue(stampKey(subCwd))) return { attempted: false, ok: true, reason: '', refAgeMs: refAgeMs(subCwd) };
  try {
    execFileSync('git', ['-C', subCwd, 'fetch', '--quiet', 'origin', 'main'], {
      stdio: ['ignore', 'ignore', 'pipe'], timeout: FETCH_TIMEOUT_MS, windowsHide: true, env: { ...process.env, ...FETCH_ENV },
    });
    stampFetch(stampKey(subCwd));
    return { attempted: true, ok: true, reason: '', refAgeMs: refAgeMs(subCwd) };
  } catch (e) {
    return { attempted: true, ok: false, reason: reasonOf(e), refAgeMs: refAgeMs(subCwd) };
  }
}
