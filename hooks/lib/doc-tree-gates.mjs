// Hook-side checks for the doc tree (KIT-T284; the tree itself is scripts/doc-tree.mjs).
// A repo is covered once docs/TREE.md exists. Both checks are pure decisions — the hooks own
// exit codes and exclusions (check-id `doc-tree`).
//
//   newUnitMissingHeader(file, isExcluded)         pre-write: new crate/concern folder, no header
//   structuralPaths / docTreeCommitViolation       commit-gate: structure moved, tree not updated

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { join, relative, basename, dirname, resolve } from 'node:path';
import { gitRoot } from './paths.mjs';
import { walkTree, isSource, MANIFESTS, SKIP_DIRS } from '../../scripts/tree-walk.mjs';
import { adoptedDocTree, buildIndex, unitKind, HEADER, INDEX_REL, HEADER_MAX_LINES } from '../../scripts/doc-tree.mjs';

const SHOWN = 6;
const norm = (p) => p.replace(/\\/g, '/');

// realpath of the nearest existing ancestor + the not-yet-created remainder, so a path under a
// directory the write is about to create still compares equal to its git root.
function canonical(p) {
  const rest = [];
  let cur = resolve(p);
  while (!existsSync(cur) && dirname(cur) !== cur) { rest.unshift(basename(cur)); cur = dirname(cur); }
  try { cur = realpathSync.native(cur); } catch { /* keep the resolved form */ }
  return join(cur, ...rest);
}

/**
 * Block message when writing `file` creates a new crate/concern folder with no header doc.
 * `isExcluded(root, absFile)` applies the project's `doc-tree` path exclusions.
 */
export function newUnitMissingHeader(file, isExcluded = () => false) {
  const abs = canonical(file);
  let existing = dirname(abs);
  while (!existsSync(existing) && dirname(existing) !== existing) existing = dirname(existing);
  const top = gitRoot(existing);
  if (!top) return null;
  const root = canonical(top);
  if (!adoptedDocTree(root) || isExcluded(root, abs)) return null;
  const rel = norm(relative(root, abs));
  if (rel.startsWith('..') || existsSync(abs)) return null;
  const name = basename(rel);
  if (!MANIFESTS.has(name) && !isSource(name)) return null;
  const dir = norm(dirname(rel)) === '.' ? '' : norm(dirname(rel));
  if (dir.split('/').some((s) => s.startsWith('.') || SKIP_DIRS.has(s))) return null;
  const tree = walkTree(root);
  if (unitKind(tree, dir)) return null; // already a unit — an existing gap, not a new folder
  const parts = dir ? dir.split('/') : [];
  for (let i = 0; i <= parts.length; i++) {
    const p = parts.slice(0, i).join('/');
    if (!tree.has(p)) tree.set(p, { files: [], dirs: [] });
  }
  tree.get(dir).files.push(name);
  const kind = unitKind(tree, dir);
  if (!kind || existsSync(join(root, dir, HEADER))) return null;
  return `new ${kind} folder \`${dir || '.'}\` has no header doc.\n` +
    `Write ${join(dir, HEADER).replace(/\\/g, '/')} FIRST: what the ${kind} is and where to go next (at most ${HEADER_MAX_LINES} lines),\n` +
    `then regenerate the index: node scripts/doc-tree.mjs index --write`;
}

/**
 * Source/manifest paths added, deleted or renamed by the commit. `staged` mode judges the index
 * only; any other mode also counts unstaged and untracked changes (the strict direction).
 */
export function structuralPaths(root, mode, git) {
  const found = new Set();
  const read = (args) => (git(['-C', root, ...args]) || '').split('\n').filter(Boolean);
  const rows = read(['diff', '--cached', '--name-status', '-M']);
  if (mode !== 'staged') rows.push(...read(['diff', '--name-status', '-M', 'HEAD']));
  for (const row of rows) {
    const [status, a, b] = row.split('\t');
    if (status[0] === 'A' || status[0] === 'D') found.add(norm(a));
    else if (status[0] === 'R') { found.add(norm(a)); found.add(norm(b)); }
  }
  if (mode !== 'staged') for (const f of read(['ls-files', '--others', '--exclude-standard'])) found.add(norm(f));
  return [...found].filter((f) => isSource(basename(f)) || MANIFESTS.has(basename(f)));
}

/** Block message when source structure changed without the doc tree moving with it. */
export function docTreeCommitViolation(root, changed, structural) {
  if (!adoptedDocTree(root) || !structural.length) return null;
  const touched = changed.some((f) => basename(f) === HEADER || norm(f) === INDEX_REL);
  const shown = structural.slice(0, SHOWN).map((f) => `  ${f}`);
  const more = structural.length > SHOWN ? [`  +${structural.length - SHOWN} more`] : [];
  if (!touched) {
    return [
      `this commit adds, moves, renames or deletes ${structural.length} source path(s) but changes no header doc or ${INDEX_REL}:`,
      ...shown, ...more,
      `Update the affected header doc(s) (README.md in the crate/concern folder) and regenerate the index:`,
      `  node scripts/doc-tree.mjs index --write`,
    ].join('\n');
  }
  try {
    if (readFileSync(join(root, INDEX_REL), 'utf8') !== buildIndex(root)) {
      return `${INDEX_REL} is stale for the current tree — regenerate and stage it:\n  node scripts/doc-tree.mjs index --write`;
    }
  } catch {
    /* an unreadable index is not a reason to wedge a commit */
  }
  return null;
}
