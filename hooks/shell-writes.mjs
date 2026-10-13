#!/usr/bin/env node
// PreToolUse + PostToolUse (Bash|PowerShell) — files a shell call or node script changed count
// as this session's own work in the writes ledger (KIT-T436), so commit-gate's foreign-path
// check (KIT-T407) does not block a session's own `node -e` / sed / script edits.
//
// Pre stamps the call's start time; Post runs ONE `git status` and records every dirty path
// whose mtime is at/after that stamp. A file changed outside any session call (another session,
// the maintainer's editor) is never stamped and stays foreign. Parallel edits by another session
// DURING this call are indistinguishable and count as ours (the accepted window).
// No-ops on unadopted repos. Fails open on any error; never blocks.

import { statSync } from 'node:fs';
import { join } from 'node:path';
import { payload, git, gitRoot, adopted, readTurnState, writeTurnState } from './lib.mjs';
import { recordSessionPath } from './turn-writes.mjs';

const START_MAX_AGE_MS = 3600000;
const STATUS_ENTRIES_MAX = 5000;
const CLOCK_SLACK_MS = 100;
const slotOf = (sid) => `shellstart-${String(sid).replace(/[^A-Za-z0-9_-]/g, '_')}`;

// Paths from `git status --porcelain=v1 -z`: "XY path\0", with a second "origpath\0" after a rename/copy.
export function dirtyPaths(porcelain) {
  const parts = String(porcelain).split('\0');
  const out = [];
  for (let i = 0; i < parts.length && out.length < STATUS_ENTRIES_MAX; i++) {
    const e = parts[i];
    if (e.length < 4) continue;
    if (/[RC]/.test(e.slice(0, 2))) i++;
    if (!e.startsWith(' D') && !e.startsWith('D ')) out.push(e.slice(3));
  }
  return out;
}

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

  if (!isPost) {
    starts[key] = now;
    writeTurnState(root, { starts }, slot);
    process.exit(0);
  }

  const startedAt = starts[key] ?? Math.min(now, ...Object.values(starts));
  delete starts[key];
  writeTurnState(root, { starts }, slot);
  for (const rel of dirtyPaths(git(['status', '--porcelain=v1', '-z', '--untracked-files=all'], root))) {
    try {
      if (statSync(join(root, rel)).mtimeMs >= startedAt - CLOCK_SLACK_MS) recordSessionPath(root, rel, sid);
    } catch { /* vanished or unreadable: not recorded */ }
  }
} catch {
  /* the ledger is best-effort */
}
process.exit(0);
