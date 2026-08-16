#!/usr/bin/env node
// PreToolUse (Write|Edit) — tree-liveness guard (KIT-T219). WARN (stderr, exit 0) before
// editing a file in a repo OTHER than this session's, when that repo shows signs of a live
// session of its own: a commit newer than the window (default 30 min), or dirty paths this
// session did not write (the KIT-T106 turn-writes ledger says which).
//
// Never blocks; one warning per foreign repo per turn. Fails open on any error.
// Window: CLAUDE_KIT_LIVE_TREE_MINUTES. Escape: [allow-live-tree: <reason>] in the prompt,
// or CLAUDE_KIT_ALLOW_LIVE_TREE=1.

import { dirname } from 'node:path';
import { payload, git, gitRoot, adopted, excludeFooter, pathExcluded, readTurnState, writeTurnState } from './lib.mjs';
import { liveness, LIVE_WINDOW_MIN } from './live-sessions.mjs';

const CHECK = 'tree-liveness';
const MAX_SHOWN = 5;

const norm = (p) => String(p || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();

// The identity of a REPO, not of a checkout: two linked worktrees of one repo share a
// common git dir, so an edit across them is not a foreign-repo edit.
function repoId(dir) {
  const common = git(['rev-parse', '--path-format=absolute', '--git-common-dir'], dir).trim();
  return norm(common) || norm(gitRoot(dir));
}

function windowMin() {
  const raw = Number(process.env.CLAUDE_KIT_LIVE_TREE_MINUTES);
  return Number.isFinite(raw) && raw > 0 ? raw : LIVE_WINDOW_MIN;
}

// One warning per foreign repo per turn — a multi-file edit run must not spam.
function alreadyWarned(sessionRoot, id) {
  const prev = readTurnState(sessionRoot, CHECK) || {};
  const seen = Array.isArray(prev.repos) ? prev.repos : [];
  if (seen.includes(id)) return true;
  writeTurnState(sessionRoot, { ts: Date.now(), repos: [...seen, id] }, CHECK);
  return false;
}

try {
  const p = await payload();
  const file = (p.tool_input && (p.tool_input.file_path || p.tool_input.path)) || '';
  if (!file) process.exit(0);

  const sessionRoot = gitRoot(process.cwd());
  const targetRoot = gitRoot(dirname(file));
  if (!sessionRoot || !targetRoot) process.exit(0);
  if (repoId(process.cwd()) === repoId(dirname(file))) process.exit(0);
  if (!adopted(sessionRoot) && !adopted(targetRoot)) process.exit(0);
  if (pathExcluded(sessionRoot, CHECK, file) || pathExcluded(targetRoot, CHECK, file)) process.exit(0);

  const prompt = (readTurnState(sessionRoot, 'request-capture') || {}).prompt || '';
  if (/\[allow-live-tree\b/i.test(prompt) || /^(1|true|yes)$/i.test(process.env.CLAUDE_KIT_ALLOW_LIVE_TREE || '')) process.exit(0);

  const { commit, dirty } = liveness(targetRoot, windowMin());
  if (!commit && !dirty.length) process.exit(0);
  if (alreadyWarned(sessionRoot, repoId(dirname(file)))) process.exit(0);

  const lines = [
    '',
    `WARNING: editing a file in ANOTHER repo that looks LIVE (KIT-T219).`,
    `  file:    ${file}`,
    `  repo:    ${targetRoot}`,
    `  session: ${sessionRoot}`,
    '',
    'Evidence of a second session there:',
  ];
  if (commit) lines.push(`  • HEAD ${commit.sha} is ${commit.minutes} min old — "${commit.subject}" (${commit.author})`);
  if (dirty.length) {
    lines.push(`  • ${dirty.length} dirty path(s) this session did not write:`);
    for (const d of dirty.slice(0, MAX_SHOWN)) lines.push(`      ${d}`);
    if (dirty.length > MAX_SHOWN) lines.push(`      +${dirty.length - MAX_SHOWN} more`);
  }
  lines.push(
    '',
    "That session's next commit can scoop your half-written edits into its own change.",
    'Coordinate with it, or take a worktree of that repo and edit there.',
    '',
    'Deliberate, logged escape: include [allow-live-tree: <reason>] in the prompt, or set',
    'CLAUDE_KIT_ALLOW_LIVE_TREE=1.',
  );
  process.stderr.write(lines.join('\n') + excludeFooter(CHECK));
  process.exit(0);
} catch {
  process.exit(0); // fail-open per HOOK CONTRACT
}
