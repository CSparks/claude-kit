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

export function recordTurnWrite(root, file) {
  const rel = repoRelative(root, file);
  if (!rel) return;
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
