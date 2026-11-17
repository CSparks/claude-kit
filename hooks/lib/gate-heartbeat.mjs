// Per-session gate heartbeats: proof that a hook script ran in a session.
//
// compat-core drops one empty marker file per (session, event, script) the first time the
// script runs, plus one per tool name a tool event carried. A session's hook wiring is fixed at
// its start, so a gate added to hooks.json later never runs there and leaves no marker; the
// wiring check (gate-wiring.mjs) reads the markers to name it.
//
// Machine-local and disposable (the turn-state temp dir; CLAUDE_KIT_TURN_STATE isolates tests).
// Every write is best-effort: a heartbeat must never break a hook.

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stateDir } from './turn-state.mjs';

const TOOL_EVENTS = new Set(['PreToolUse', 'PostToolUse']);
const RUN = 'run';
const TOOL = 'tool';
const STOPS_FILE = 'stops';
const WARNED_FILE = 'warned';
const NAME_UNSAFE = /[^A-Za-z0-9_.-]/g;
const NAME_MAX = 80;
const STALE_DIR_MS = 14 * 24 * 60 * 60 * 1000;

const safe = (text) => String(text).replace(NAME_UNSAFE, '_').slice(0, NAME_MAX);
const root = () => join(stateDir(), 'gate-heartbeats');
const sessionDir = (session) => join(root(), safe(session));
const marker = (session, kind, ...parts) => join(sessionDir(session), [kind, ...parts.map(safe)].join('.'));

function touch(file, session) {
  if (existsSync(file)) return;
  mkdirSync(sessionDir(session), { recursive: true });
  writeFileSync(file, '');
}

/** Mark that `scriptName` ran for the payload's session and event; mark the tool a tool event carried. */
export function recordHeartbeat(payload, scriptName) {
  try {
    const session = payload?.session_id;
    const event = payload?.hook_event_name;
    if (!session || !event) return;
    touch(marker(session, RUN, event, scriptName), session);
    if (TOOL_EVENTS.has(event) && payload.tool_name) touch(marker(session, TOOL, payload.tool_name), session);
  } catch {
    /* best-effort */
  }
}

export const heartbeatRan = (session, event, scriptName) => existsSync(marker(session, RUN, event, scriptName));

/** Tool names (as stored: unsafe characters replaced) any tool event of the session carried. */
export function toolsSeen(session) {
  try {
    const head = `${TOOL}.`;
    return readdirSync(sessionDir(session)).filter((f) => f.startsWith(head)).map((f) => f.slice(head.length));
  } catch {
    return [];
  }
}

/** Count one Stop of the session; returns the count including this one. Also drops long-dead session dirs. */
export function countStop(session) {
  try {
    mkdirSync(sessionDir(session), { recursive: true });
    const file = join(sessionDir(session), STOPS_FILE);
    appendFileSync(file, '.');
    utimesSync(sessionDir(session), new Date(), new Date());
    pruneStale();
    return statSync(file).size;
  } catch {
    return 0;
  }
}

function pruneStale() {
  const now = Date.now();
  for (const name of readdirSync(root())) {
    const dir = join(root(), name);
    try {
      if (now - statSync(dir).mtimeMs > STALE_DIR_MS) rmSync(dir, { recursive: true, force: true });
    } catch {
      /* gone already */
    }
  }
}

/** Keys of missing-gate sets already warned about in the session. */
export function warnedKeys(session) {
  try {
    return readFileSync(join(sessionDir(session), WARNED_FILE), 'utf8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

export function markWarned(session, key) {
  try {
    mkdirSync(sessionDir(session), { recursive: true });
    appendFileSync(join(sessionDir(session), WARNED_FILE), `${key}\n`);
  } catch {
    /* best-effort */
  }
}
