// The turn's WRITES LEDGER (KIT-T106) — which repo-relative paths this turn's Write/Edit
// calls touched. pre-write records; commit-gate reads, so a bare `git commit` can name the
// staged paths the turn did NOT author.
//
// Machine-local turn state, never a durable record: entries are timestamped so a reader can
// bound them to the current turn, the list is capped, and every path fails open — a lost
// entry costs at most a missing warning.

import { basename, dirname } from 'node:path';
import { git, readTurnState, writeTurnState } from './lib.mjs';

export const TURN_WRITES_SLOT = 'writes';
const TURN_WRITES_MAX = 300;

// Repo-relative, POSIX, no leading './' — the shape `git diff --cached --name-only` prints.
// '' when the file is not inside a git repo.
//
// git answers this, not string arithmetic: the payload's path and the git root can be two
// spellings of the same directory (a Windows 8.3 short name, a symlinked temp dir), which a
// prefix test gets wrong. `rev-parse --show-prefix` is asked in the file's OWN directory, so
// it also works for a file the Write is about to create.
export function repoRelative(root, file) {
  const raw = String(file || '');
  if (!raw) return '';
  const prefix = git(['rev-parse', '--show-prefix'], dirname(raw)).trim();
  if (prefix === '' && !git(['rev-parse', '--is-inside-work-tree'], dirname(raw)).trim()) return '';
  return `${prefix}${basename(raw)}`;
}

const SESSION_WRITES_MAX = 3000;
const sessionSlot = (sid) => `swrites-${String(sid).replace(/[^A-Za-z0-9_-]/g, '_')}`;

export function recordTurnWrite(root, file, sessionId = '') {
  const rel = repoRelative(root, file);
  if (!rel) return;
  if (sessionId) recordSessionWrite(root, rel, sessionId);
  const prev = readTurnState(root, TURN_WRITES_SLOT) || {};
  const files = Array.isArray(prev.files) ? prev.files : [];
  files.push({ p: rel, ts: Date.now() });
  writeTurnState(root, { files: files.slice(-TURN_WRITES_MAX) }, TURN_WRITES_SLOT);
}

// Paths written at/after `sinceMs` (0 = every recorded path), as a Set of repo-relative paths.
export function turnWrites(root, sinceMs = 0) {
  const state = readTurnState(root, TURN_WRITES_SLOT) || {};
  const files = Array.isArray(state.files) ? state.files : [];
  return new Set(files.filter((f) => f && f.p && (f.ts || 0) >= sinceMs).map((f) => f.p));
}

// When the current turn started: the UserPromptSubmit capture snapshot's timestamp, or 0 when
// unavailable — then the whole ledger counts, the lenient direction (fewer false warnings).
export function turnStartMs(root) {
  const snap = readTurnState(root, 'request-capture') || {};
  return Number(snap.ts) || 0;
}

// SESSION ledger (KIT-T407): every repo-relative path this SESSION's Write/Edit calls touched,
// kept per session id so a second session in the same checkout is never mistaken for this one.
function recordSessionWrite(root, rel, sessionId) {
  const slot = sessionSlot(sessionId);
  const prev = readTurnState(root, slot) || {};
  const files = Array.isArray(prev.files) ? prev.files : [];
  if (!files.includes(rel)) files.push(rel);
  writeTurnState(root, { files: files.slice(-SESSION_WRITES_MAX) }, slot);
}

export function sessionWrites(root, sessionId) {
  if (!sessionId) return new Set();
  const state = readTurnState(root, sessionSlot(sessionId)) || {};
  return new Set(Array.isArray(state.files) ? state.files : []);
}

// Workflow-store paths are written by cap/t through Bash, so no Write hook sees them.
const isStorePath = (p) => p.startsWith('.ai/') || p.includes('/.ai/');

// Source paths in `paths` this session never wrote. [] when the session has no ledger (a
// resumed or unidentified session cannot be judged — fail open).
export function foreignPaths(root, paths, sessionId) {
  const mine = sessionWrites(root, sessionId);
  if (!mine.size) return [];
  return paths.filter((p) => !isStorePath(p) && !mine.has(p));
}
