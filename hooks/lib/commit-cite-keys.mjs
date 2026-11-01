// A code commit's cited work-item key must belong to a store the commit answers to (KIT-T799):
// this repo's own key, or the key of a submodule the commit touches (its own `.ai`, or the
// registered project it is named after). A repo with no `ids.key` is not judged (fail open).
//
//   foreignCiteProblem(root, changed, command) -> null, or { cited, expected } when every cited
//   key is foreign.

import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ID_CITE_SRC } from './ids.mjs';
import { readIdConfig } from '../../scripts/id-utils.mjs';
import { readRegistry } from './registry.mjs';
import { storeRoot } from './paths.mjs';

const KEY_OF_CITE = /^(.+)-[TDNQRE]\d+$/;

export function citedKeys(command) {
  const cites = command.match(new RegExp(String.raw`\b${ID_CITE_SRC}\b`, 'g')) || [];
  return [...new Set(cites.map((c) => c.match(KEY_OF_CITE)[1]))];
}

function submodulePaths(root) {
  try {
    const text = readFileSync(join(root, '.gitmodules'), 'utf8');
    return [...text.matchAll(/^\s*path\s*=\s*(.+?)\s*$/gm)].map((m) => m[1].replace(/\\/g, '/'));
  } catch {
    return [];
  }
}

function submoduleKeys(root, changed) {
  const registry = readRegistry();
  const keys = [];
  for (const sub of submodulePaths(root)) {
    if (!changed.some((f) => f === sub || f.startsWith(`${sub}/`))) continue;
    if (existsSync(join(root, sub, '.ai', 'config.yml'))) keys.push(readIdConfig(join(root, sub)).key);
    const registered = registry.projects[basename(sub)];
    const owner = registered ? storeRoot(registered) : null;
    if (owner) keys.push(readIdConfig(owner).key);
  }
  return keys.filter(Boolean);
}

export function foreignCiteProblem(root, changed, command) {
  const own = readIdConfig(root).key;
  const cited = citedKeys(command);
  if (!own || !cited.length) return null;
  const expected = [own, ...submoduleKeys(root, changed)];
  return cited.some((k) => expected.includes(k)) ? null : { cited, expected: [...new Set(expected)] };
}
