// anchor-landings — one dated line per landed commit in the SESSION.md anchor (KIT-T1150), written through
// `t session`'s writer so the anchor is current after any landing: the main thread's, a subagent's, the broker's.
// A submodule's commit is noted in the parent's store, its line prefixed `<submodule path>@`.
// Only commits this clone made itself this turn are noted (a pulled or fetched commit never is), the subject
// is sanitized, a submodule whose path is not plain (word characters, dot, slash, hyphen; no `..`; inside the
// repo) is left out, and the writer refuses a linked anchor (anchor-guard.mjs).
// The line only ever adds to the anchor: nothing is rewritten, trimmed or backed up.
//
//   noteLandings(store, turnStartMs, { now }) -> { noted: [line], failed }   notes every commit since the turn start
//                                                                            that touches project files and is not noted yet
//   isNoted(store, sha)                       -> true when the anchor already carries a line for that commit
//
// Idempotent per sha: the line starts `landed <label><7-char sha> `, which isNoted looks for (the broker's
// `broker landed <sha>` line from KIT-T1051 counts too).
// A repo without a .ai store is untouched; a failed write is reported in `failed`, never thrown.

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, sep } from 'node:path';
import { writeSession } from '../../scripts/t-session.mjs';
import { git } from './exec.mjs';
import { TURN_SKEW_MS, commitState, commitsSince, madeLocally, submodulesOf, touchesProjectFiles } from './landed-commits.mjs';

const SHA_CHARS = 7;
const SUBJECT_MAX = 100;
const LABEL_MAX = 60;
const SAFE_PATH = /^[\w./-]+$/;

const short = (sha) => sha.slice(0, SHA_CHARS);

function anchorText(store) {
  try { return readFileSync(join(store, '.ai', 'SESSION.md'), 'utf8'); } catch { return ''; }
}

// Any `landed [<path>@]<sha prefix>` line counts, the broker's `broker landed <sha>` note (KIT-T1051) included.
export const isNoted = (store, sha) => new RegExp(`\\blanded (?:\\S+@)?${short(sha)}`).test(anchorText(store));

// The anchor is read as trusted context by every later session, so a subject enters it as plain quoted text:
// control, format, markup and tag characters become spaces and the length is capped.
const UNSAFE_CHARS = /[\p{C}<>`[\]*#|\\]/gu;

export function safeSubject(subject) {
  const text = String(subject).replace(UNSAFE_CHARS, ' ').replace(/"/g, "'").replace(/\s+/g, ' ').trim();
  return `"${text.length > SUBJECT_MAX ? `${text.slice(0, SUBJECT_MAX - 1)}…` : text}"`;
}

function noteLine(root, label, c) {
  const ids = c.ids.length ? ` (${c.ids.join(', ')})` : '';
  return `landed ${label}${short(c.sha)} ${safeSubject(c.subject)}${ids}: ${commitState(root, c.sha)}`;
}

// Only a commit this clone made itself this turn, as the configured identity, dated no later than now.
function isOwnCommit(c, made, email, nowMs) {
  return made.has(c.sha) && c.committedMs <= nowMs + TURN_SKEW_MS && (!email || c.authorEmail === email);
}

// The label a submodule's line carries, or null when its path is not a plain relative path inside the repo
// (`.gitmodules` is repo content, so the path is untrusted).
function submoduleLabel(store, root) {
  const rel = relative(store, root).split(sep).join('/');
  const real = (p) => { try { return realpathSync.native(p); } catch { return null; } };
  const inside = relative(real(store) || store, real(root) || root);
  const plain = SAFE_PATH.test(rel) && rel.length <= LABEL_MAX && !rel.split('/').includes('..') && !isAbsolute(rel);
  return plain && !inside.startsWith('..') && !isAbsolute(inside) ? `${rel}@` : null;
}

function unnoted(store, turnStartMs, nowMs) {
  const pending = [];
  const window = { sinceMs: turnStartMs, skewMs: TURN_SKEW_MS };
  for (const root of [store, ...submodulesOf(store)]) {
    const label = root === store ? '' : submoduleLabel(store, root);
    if (label === null) continue;
    const made = madeLocally(root, window);
    const email = git(['-C', root, 'config', 'user.email']).trim();
    const fresh = commitsSince(root, window)
      .filter((c) => isOwnCommit(c, made, email, nowMs) && touchesProjectFiles(root, c.sha) && !isNoted(store, c.sha));
    for (const c of fresh.reverse()) pending.push(noteLine(root, label, c));
  }
  return pending;
}

export function noteLandings(store, turnStartMs, { now = new Date() } = {}) {
  const result = { noted: [], failed: false };
  if (!turnStartMs || !existsSync(join(store, '.ai'))) return result;
  try {
    for (const line of unnoted(store, turnStartMs, now.getTime())) {
      writeSession(store, line, { now, backup: false });
      result.noted.push(line);
    }
  } catch {
    result.failed = true;
  }
  return result;
}
