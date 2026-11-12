// Which working TREE a delegation lands in — the one fact `shared-tree-dispatch`, checkout-holder,
// broker-owned-tree and the roster compare on. It is the `[tree: <path>]` tag when that path is a
// repo root, else the session checkout; a path a brief merely mentions in prose retargets nothing
// (KIT-T1103). An unresolvable target is the session's tree: the side that keeps the halt.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { gitRoot } from './lib.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';

const ABSOLUTE = /^(?:[A-Za-z]:[\\/]|\/|\\\\)/;

export const TREE_FROM_TAG = 'the tree tag';
export const TREE_FROM_SESSION = 'the session checkout';

export function isWorktreeIsolation(value) {
  return /^worktree$/i.test(String(value ?? '').trim());
}

// The checkout a brief declares with `[tree: <path>]` when that path is a repo root, canonicalized; '' otherwise.
export function declaredTreeRoot(input) {
  try {
    const declared = treeToken(input);
    return declared && isRepoRoot(declared) ? gitRoot(declared) || declared : '';
  } catch {
    return '';
  }
}

// The repo root the dispatched agent works in, and where that answer came from. The root is
// canonicalized through git so it compares equal to a row that repo wrote.
export function dispatchTarget(sessionRoot, input) {
  const declared = declaredTreeRoot(input);
  return declared ? { root: declared, source: TREE_FROM_TAG } : { root: sessionRoot, source: TREE_FROM_SESSION };
}

export function dispatchTargetRoot(sessionRoot, input) {
  return dispatchTarget(sessionRoot, input).root;
}

// Is this roster row a colleague in `targetRoot`'s checkout? A worktree-isolated agent never is.
// A row with no targetRoot predates the field: counted, the conservative side of the halt.
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

function treeToken(input) {
  const m = String(input?.prompt ?? input?.message ?? '').match(TOKENS.tree.pattern);
  const path = m ? m[1].trim().replace(/^["'`]|["'`]$/g, '') : '';
  return ABSOLUTE.test(path) ? path : '';
}

// A worktree's .git is a FILE, a normal checkout's a directory — existsSync accepts both.
function isRepoRoot(p) {
  try {
    return existsSync(join(p, '.git'));
  } catch {
    return false;
  }
}
