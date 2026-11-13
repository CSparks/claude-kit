// anchor-landings — one dated line per landed commit in the SESSION.md anchor (KIT-T1150), written through
// `t session`'s writer so the anchor is current after any landing: the main thread's, a subagent's, the broker's.
// A submodule's commit is noted in the parent's store, its line prefixed `<submodule path>@`.
// The line only ever adds to the anchor: nothing is rewritten, trimmed or backed up.
//
//   noteLandings(store, turnStartMs, { now }) -> { noted: [line], failed }   notes every commit since the turn start
//                                                                            that touches project files and is not noted yet
//   isNoted(store, sha)                       -> true when the anchor already carries a line for that commit
//
// Idempotent per sha: the line starts `landed <label><7-char sha> `, which isNoted looks for (the broker's
// `broker landed <sha>` line from KIT-T1051 counts too).
// A repo without a .ai store is untouched; a failed write is reported in `failed`, never thrown.

import { existsSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { writeSession } from '../../scripts/t-session.mjs';
import { TURN_SKEW_MS, commitState, commitsSince, submodulesOf, touchesProjectFiles } from './landed-commits.mjs';

const SHA_CHARS = 7;

const short = (sha) => sha.slice(0, SHA_CHARS);

function anchorText(store) {
  try { return readFileSync(join(store, '.ai', 'SESSION.md'), 'utf8'); } catch { return ''; }
}

// Any `landed [<path>@]<sha prefix>` line counts, the broker's `broker landed <sha>` note (KIT-T1051) included.
export const isNoted = (store, sha) => new RegExp(`\\blanded (?:\\S+@)?${short(sha)}`).test(anchorText(store));

function noteLine(root, label, c) {
  const ids = c.ids.length ? ` (${c.ids.join(', ')})` : '';
  return `landed ${label}${short(c.sha)} ${c.subject}${ids}: ${commitState(root, c.sha)}`;
}

function unnoted(store, turnStartMs) {
  const pending = [];
  for (const root of [store, ...submodulesOf(store)]) {
    const label = root === store ? '' : `${relative(store, root).split(sep).join('/')}@`;
    const fresh = commitsSince(root, { sinceMs: turnStartMs, skewMs: TURN_SKEW_MS })
      .filter((c) => touchesProjectFiles(root, c.sha) && !isNoted(store, c.sha));
    for (const c of fresh.reverse()) pending.push(noteLine(root, label, c));
  }
  return pending;
}

export function noteLandings(store, turnStartMs, { now = new Date() } = {}) {
  const result = { noted: [], failed: false };
  if (!turnStartMs || !existsSync(join(store, '.ai'))) return result;
  try {
    for (const line of unnoted(store, turnStartMs)) {
      writeSession(store, line, { now, backup: false });
      result.noted.push(line);
    }
  } catch {
    result.failed = true;
  }
  return result;
}
