// rr.mjs — round-robin between sessions (KIT-T482 item 8). Each job carries the `session` that
// submitted it; the queue serves sessions in turn instead of strictly by submit time, so one
// session's burst of patches never holds another session's single patch behind it. A session's own
// jobs keep their order, and a job never passes an older job of another session that touches one of
// its paths (they stay in submit order). Jobs without a session share one turn.
//
// `roundRobin(jobs, last)` → the jobs in serving order; `last` is the session served last.
// `lastServed(cfg)` / `markServed(cfg, session)` keep that across drains (<broker home>/rr.json).
// `jobSession(flags, env, aiDir)` → the submitting session's id, or null.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { readIdentity } from '../../hooks/lib/session-identity.mjs';

const SESSION_ENVS = ['CLAUDE_SESSION_ID', 'CLAUDE_CODE_SESSION_ID'];
const ANON = '';
const posix = (p) => String(p).replace(/\\/g, '/');
const pathsOf = (job) => (job.ops || []).map((o) => posix(o.path));
const sessionOf = (job) => job.session || ANON;

export function jobSession(flags, env = process.env, aiDir = null) {
  if (typeof flags.session === 'string' && flags.session) return flags.session;
  const fromEnv = SESSION_ENVS.map((k) => env[k]).find(Boolean);
  if (fromEnv) return fromEnv;
  try { return (aiDir && readIdentity(aiDir).session) || null; } catch { return null; }
}

const file = (cfg) => join(brokerPaths(cfg).home, 'rr.json');
export function lastServed(cfg) {
  try { return JSON.parse(readFileSync(file(cfg), 'utf8')).last ?? null; } catch { return null; }
}
export function markServed(cfg, session) {
  try { writeFileSync(file(cfg), JSON.stringify({ last: session || ANON, at: new Date().toISOString() })); } catch { /* best effort */ }
}

// The job that must run before `job`: an older pending job touching one of its paths, followed back
// to the first one with no older overlap of its own; `job` itself when none.
function oldestBlocker(pending, job) {
  let at = job;
  for (;;) {
    const mine = new Set(pathsOf(at));
    const older = pending.slice(0, pending.indexOf(at)).find((j) => pathsOf(j).some((p) => mine.has(p)));
    if (!older) return at;
    at = older;
  }
}

export function roundRobin(jobs, last = null) {
  const pending = jobs.slice();
  const sessions = [...new Set(pending.map(sessionOf))];
  if (sessions.length < 2) return pending;
  const out = [];
  let turn = last === null ? 0 : (sessions.indexOf(last) + 1) % sessions.length;
  while (pending.length) {
    let pick = null;
    for (let k = 0; k < sessions.length && !pick; k++) {
      const s = sessions[(turn + k) % sessions.length];
      const candidate = pending.find((j) => sessionOf(j) === s);
      if (!candidate) continue;
      pick = oldestBlocker(pending, candidate);
      turn = (sessions.indexOf(s) + 1) % sessions.length;
    }
    out.push(pick);
    pending.splice(pending.indexOf(pick), 1);
  }
  return out;
}
