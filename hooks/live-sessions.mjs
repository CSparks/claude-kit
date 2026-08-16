// Concurrent-session detection (KIT-T219 / KIT-T225) — the read-only evidence that a repo
// is being worked by ANOTHER live session right now: commits landed inside a recent window,
// and dirty paths absent from this turn's writes ledger (KIT-T106).
//
// Every reader fails open: no git, no evidence, no warning.

import { git } from './lib.mjs';
import { turnWrites, turnStartMs } from './turn-writes.mjs';

export const LIVE_WINDOW_MIN = 30; // pre-edit guard default
export const ORIENT_WINDOW_MIN = 60; // SessionStart look-back
const LOG_SCAN = 20; // commits inspected before the window filter
const STATUS_PREFIX = 3; // `XY ` status columns of a --porcelain line

// Minutes to a whole number, or null when the timestamp is unusable / in the future.
const ageMin = (epochSec, nowMs) => {
  const ms = nowMs - Number(epochSec) * 1000;
  return Number.isFinite(ms) && ms >= 0 ? Math.round(ms / 60000) : null;
};

// Commits on HEAD whose AUTHOR date falls inside the window, newest first.
export function recentCommits(root, windowMin = ORIENT_WINDOW_MIN, nowMs = Date.now()) {
  const raw = git(['-C', root, 'log', `-${LOG_SCAN}`, '--format=%h%x00%at%x00%an%x00%s'], root);
  const out = [];
  for (const line of raw.split('\n')) {
    const [sha, at, author, subject] = line.split('\0');
    if (!sha || !at) continue;
    const minutes = ageMin(at, nowMs);
    if (minutes === null || minutes >= windowMin) continue;
    out.push({ sha, minutes, author: author || '', subject: subject || '' });
  }
  return out;
}

// Paths dirty in `root` that this turn's Write/Edit ledger does not account for.
export function foreignDirty(root) {
  const mine = turnWrites(root, turnStartMs(root));
  const out = [];
  for (const line of git(['-C', root, 'status', '--porcelain'], root).split('\n')) {
    if (line.length <= STATUS_PREFIX) continue;
    const path = line.slice(STATUS_PREFIX).replace(/^"|"$/g, '').split(' -> ').pop();
    if (path && !mine.has(path)) out.push(path);
  }
  return out;
}

// The pre-edit verdict: the newest in-window commit (or null) plus the foreign dirty paths.
export function liveness(root, windowMin = LIVE_WINDOW_MIN) {
  return { commit: recentCommits(root, windowMin)[0] || null, dirty: foreignDirty(root) };
}
