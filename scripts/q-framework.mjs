// The work stores of the frameworks a repo ADOPTS. A game's questions ("does this already
// exist?") are answered as much by its framework's tickets as by its own, so retrieval and
// dedup default to the project store PLUS these. "Adopted" is the same fact orientation prints
// as FRAMEWORK CONTRACT (hooks/lib/frameworks.mjs `frameworksFor`) — never a second detector.
//
//   frameworkStores(root) -> [{ name, scope, aiDir }]   framework store key + dir; [] if none
//   searchScopes(scopeTok, root) -> string[]            scopes a default retrieval covers

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { frameworksFor } from '../hooks/lib/frameworks.mjs';
import { readIdConfig } from './id-utils.mjs';
import { defaultScope, resolveScope } from './q-model.mjs';

/** Framework stores present in `root` (a submodule carrying its own .ai with an ids.key). */
export function frameworkStores(root) {
  const out = [];
  try {
    for (const fw of frameworksFor(root)) {
      if (!fw.submodule) continue;
      const subRoot = join(root, fw.submodule);
      const aiDir = join(subRoot, '.ai');
      if (!existsSync(aiDir)) continue;
      const { key } = readIdConfig(subRoot, aiDir);
      if (key) out.push({ name: fw.name || fw.submodule, scope: key, aiDir });
    }
  } catch {
    /* framework layer unavailable — the project store alone answers */
  }
  return out;
}

/** Checked-out framework submodule dirs of `root`, with or without a work store: [{ name, dir }]. */
export function frameworkRoots(root) {
  const out = [];
  try {
    for (const fw of frameworksFor(root)) {
      if (!fw.submodule) continue;
      const dir = join(root, fw.submodule);
      if (existsSync(dir)) out.push({ name: fw.name || fw.submodule, dir });
    }
  } catch {
    /* framework layer unavailable — the project tree alone is indexed */
  }
  return out;
}

/**
 * Scopes a retrieval covers. An explicit token (`--scope X`, `all`) is honoured verbatim;
 * absent, it is the project plus every adopted framework. `[]` means no scope predicate.
 */
export function searchScopes(scopeTok, root) {
  if (String(scopeTok ?? '').trim()) {
    const s = resolveScope(scopeTok, root);
    return s ? [s] : [];
  }
  const own = defaultScope(root);
  if (!own) return [];
  return [own, ...frameworkStores(root).map((f) => f.scope).filter((k) => k !== own)];
}
