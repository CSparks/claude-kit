// code-root.mjs — the checkout q's code verbs (code, sym, file) index, for the in-process CLI and the resident server alike.
//
//   codeRoot(cwd, explicitRoot) -> directory
//     an explicit --root wins; else the checkout of the nearest store above `cwd`; a folder whose nearest store is only
//     the unbounded catch-all searches its own git repo (KIT-T1603), so a repo with no .ai store is still searchable;
//     outside every repo the catch-all stands.

import { resolveStoreRoot, isUnbounded } from '../hooks/lib/unbounded.mjs';
import { checkoutOfStoreRoot } from '../hooks/lib/store-link.mjs';
import { gitRoot } from '../hooks/lib/paths.mjs';

function repoOf(cwd) {
  try { return gitRoot(cwd) || ''; } catch { return ''; }
}

export function codeRoot(cwd, explicitRoot) {
  if (explicitRoot) return checkoutOfStoreRoot(explicitRoot);
  const store = resolveStoreRoot(cwd);
  if (store && !isUnbounded(store)) return checkoutOfStoreRoot(store);
  return repoOf(cwd) || checkoutOfStoreRoot(store || cwd);
}
