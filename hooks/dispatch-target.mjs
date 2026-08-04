// Which working TREE a delegation lands in — the single fact `shared-tree-dispatch` compares on
// (KIT-T177). The roster is written by the DISPATCHING session, so a row's mere presence says
// nothing about whether its agent is a colleague in THIS checkout: an `isolation: worktree` agent
// has its own, and a brief that names another repo sends the agent there. agent-roster.mjs stamps
// both facts on the row at dispatch time; dispatch-guard resolves the same facts for the incoming
// dispatch and compares. One resolver, so a row and a live dispatch can never disagree.
//
// FAIL-OPEN, and when it fails it fails toward the HALT: an unresolvable target is the session's
// own tree, and a row missing the fields (written before KIT-T177) still counts as a tree-mate.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { gitRoot } from './lib.mjs';

// A brief names its target repo as an absolute path, quoted (`D:\dev\claude-kit`) or bare. Quoted
// is tried first because a checkout under a spaced path ("D:\my repos\app") survives only quoted.
const QUOTED_PATH = /[`'"]([^`'"\n]+)[`'"]/g;
const BARE_PATH = /(?:[A-Za-z]:[\\/]|\/)[^\s"'`)\],;]+/g;
const ABSOLUTE = /^(?:[A-Za-z]:[\\/]|\/|\\\\)/;
const TRAILING_PUNCT = /[.,;:!?)\]}"'`]+$/;

export function isWorktreeIsolation(value) {
  return /^worktree$/i.test(String(value ?? '').trim());
}

// The repo root the dispatched agent will actually work in. Only a path that IS a repo root
// counts — a passing mention of a file inside another checkout must not retarget the dispatch —
// and the answer is canonicalized through git so it compares equal to a row that repo wrote.
export function dispatchTargetRoot(sessionRoot, input) {
  try {
    for (const candidate of candidates(input)) {
      if (!isRepoRoot(candidate)) continue;
      const resolved = gitRoot(candidate) || candidate;
      if (!sameTree(resolved, sessionRoot)) return resolved;
    }
  } catch {
    /* unresolvable — the session's own tree is the answer that keeps the halt */
  }
  return sessionRoot;
}

// Is this roster row a colleague in `targetRoot`'s checkout? A worktree-isolated agent never is.
// A row with no targetRoot predates KIT-T177: counted, the conservative side of the halt.
export function rowSharesTree(row, targetRoot) {
  if (!row) return false;
  if (isWorktreeIsolation(row.isolation)) return false;
  if (!row.targetRoot) return true;
  return sameTree(row.targetRoot, targetRoot);
}

export function sameTree(a, b) {
  const left = normalizeTree(a);
  return !!left && left === normalizeTree(b);
}

// Separators and case are presentation, not identity: git reports forward slashes, a brief may
// paste backslashes, and Windows resolves either case to one tree. Collapsing them can only make
// two roots compare EQUAL — the side that keeps the block.
function normalizeTree(p) {
  return String(p ?? '').trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function candidates(input) {
  const out = [];
  for (const v of [input?.cwd, input?.working_directory, input?.workdir, input?.directory]) {
    if (typeof v === 'string' && v.trim()) out.push(v);
  }
  const prompt = String(input?.prompt ?? '');
  for (const m of prompt.matchAll(QUOTED_PATH)) out.push(m[1]);
  for (const m of prompt.matchAll(BARE_PATH)) out.push(m[0]);
  return out.map((s) => s.trim().replace(TRAILING_PUNCT, '')).filter((s) => ABSOLUTE.test(s));
}

// A worktree's .git is a FILE, a normal checkout's a directory — existsSync accepts both.
function isRepoRoot(p) {
  try {
    return existsSync(join(p, '.git'));
  } catch {
    return false;
  }
}
