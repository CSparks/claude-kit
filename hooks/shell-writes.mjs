#!/usr/bin/env node
// PreToolUse + PostToolUse (Bash|PowerShell) — files a shell call or node script changed count
// as this session's own work in the writes ledger (KIT-T436), so commit-gate's foreign-path
// check (KIT-T407) does not block a session's own `node -e` / sed / script edits.
//
// Pre stamps the call's start time and the tracked paths already removed; Post runs ONE `git status` and records every
// dirty path whose mtime is at/after that stamp, plus every path removed since Pre (`git rm`, `rm`; KIT-T1110). A file changed outside any session call (another session,
// the maintainer's editor) is never stamped and stays foreign. Parallel edits by another session
// DURING this call count as ours unless an Edit or Write tool left that exact content (the accepted-writes
// ledger, KIT-T888): a tool's write is credited by pre-write to the session that made it, never to a shell
// call it overlapped (KIT-T953).
// No-ops on unadopted repos. Fails open on any error; never blocks.

import { statSync } from 'node:fs';
import { join } from 'node:path';
import { payload, git, gitRoot, adopted, readTurnState, writeTurnState } from './lib.mjs';
import { recordSessionPath } from './turn-writes.mjs';
import { contentHashOf } from './lib/shell-snapshot.mjs';
import { toolWriteProves, writerId } from './lib/tool-writes.mjs';
import { subagentId } from './lib/subagent-id.mjs';

const START_MAX_AGE_MS = 3600000;
const STATUS_ENTRIES_MAX = 5000;
const CLOCK_SLACK_MS = 100;
const MIN_ENTRY_LENGTH = 4;
const slotOf = (sid) => `shellstart-${String(sid).replace(/[^A-Za-z0-9_-]/g, '_')}`;

// Paths from `git status --porcelain=v1 -z`: "XY path\0", with a second "origpath\0" after a rename/copy.
export function dirtyPaths(porcelain) {
  const parts = String(porcelain).split('\0');
  const out = [];
  for (let i = 0; i < parts.length && out.length < STATUS_ENTRIES_MAX; i++) {
    const e = parts[i];
    if (e.length < MIN_ENTRY_LENGTH) continue;
    if (/[RC]/.test(e.slice(0, 2))) i++;
    if (!e.startsWith(' D') && !e.startsWith('D ')) out.push(e.slice(MIN_ENTRY_LENGTH - 1));
  }
  return out;
}

// Tracked paths the porcelain shows removed from the work tree or the index. A removal leaves no mtime, so a call's
// own deletions are the ones absent from the Pre snapshot and present at Post.
export function deletedPaths(porcelain) {
  const parts = String(porcelain).split('\0');
  const out = [];
  for (let i = 0; i < parts.length && out.length < STATUS_ENTRIES_MAX; i++) {
    const e = parts[i];
    if (e.length < MIN_ENTRY_LENGTH) continue;
    if (/[RC]/.test(e.slice(0, 2))) { i++; continue; }
    if (e[0] === 'D' || e[1] === 'D') out.push(e.slice(MIN_ENTRY_LENGTH - 1));
  }
  return out;
}

const statusOf = (root) => git(['status', '--porcelain=v1', '-z', '--untracked-files=all'], root);

try {
  const p = await payload();
  const sid = p.session_id;
  if (!sid) process.exit(0);
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);

  const slot = slotOf(sid);
  const key = String(p.tool_use_id || 'call');
  const now = Date.now();
  const state = readTurnState(root, slot) || {};
  const starts = Object.fromEntries(Object.entries(state.starts || {}).filter(([, t]) => now - t < START_MAX_AGE_MS));
  const isPost = p.hook_event_name === 'PostToolUse' || (p.hook_event_name === undefined && p.tool_response !== undefined);

  const removedBefore = Object.fromEntries(Object.entries(state.removed || {}).filter(([k]) => k in starts));

  if (!isPost) {
    starts[key] = now;
    removedBefore[key] = deletedPaths(statusOf(root));
    writeTurnState(root, { starts, removed: removedBefore }, slot);
    process.exit(0);
  }

  const startedAt = starts[key] ?? Math.min(now, ...Object.values(starts));
  const status = statusOf(root);
  const alreadyRemoved = new Set(removedBefore[key]);
  const ownRemovals = key in removedBefore ? deletedPaths(status).filter((rel) => !alreadyRemoved.has(rel)) : [];
  delete starts[key];
  delete removedBefore[key];
  writeTurnState(root, { starts, removed: removedBefore }, slot);
  for (const rel of ownRemovals) recordSessionPath(root, rel, sid);
  const caller = writerId(sid, subagentId(p));
  for (const rel of dirtyPaths(status)) {
    try {
      const touched = statSync(join(root, rel)).mtimeMs >= startedAt - CLOCK_SLACK_MS;
      if (touched && !toolWriteProves(root, rel, startedAt, contentHashOf(root, rel), caller)) recordSessionPath(root, rel, sid);
    } catch { /* vanished or unreadable: not recorded */ }
  }
} catch {
  /* the ledger is best-effort */
}
process.exit(0);
