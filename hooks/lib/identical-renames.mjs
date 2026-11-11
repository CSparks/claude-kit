// A byte-identical rename (KIT-T991): a path git has staged as the destination of an R100 rename whose working-tree
// content still equals the staged blob. A move authors nothing, so neither hand-write-detect nor commit-gate's
// hand-write ledger holds it for an Edit or Write re-save.
//
//   identicalRenames(root, rels) -> Set of the paths in `rels` that are unchanged R100 rename destinations
//   unmovedHandWrites(root, rels) -> `rels` without those paths
//   onlyIdenticalRenames(root, pathspec) -> true when nothing under `pathspec` changed except by such renames

import { gitTry } from './exec.mjs';

const RENAME_FIELDS = 2;
const IDENTICAL = 'R100';
const SCORED_STATUS = /^[RC]\d+$/;

/** Destination paths of the staged R100 renames. */
function stagedIdenticalRenames(root) {
  const listing = gitTry(['diff', '--cached', '-M', '--name-status', '-z'], root);
  const renames = new Set();
  if (!listing.ok) return renames;
  const parts = listing.out.split('\0');
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === IDENTICAL) renames.add(parts[i + RENAME_FIELDS]);
    if (SCORED_STATUS.test(parts[i])) i += RENAME_FIELDS;
  }
  return renames;
}

/** Every path whose working tree differs from the index; null when git cannot answer. */
function editedSinceStaging(root) {
  const listing = gitTry(['diff', '--name-only', '-z'], root);
  return listing.ok ? new Set(listing.out.split('\0').filter(Boolean)) : null;
}

export function identicalRenames(root, rels) {
  if (!rels.length) return new Set();
  const staged = stagedIdenticalRenames(root);
  const candidates = rels.filter((rel) => staged.has(rel));
  if (!candidates.length) return new Set();
  const edited = editedSinceStaging(root);
  return edited ? new Set(candidates.filter((rel) => !edited.has(rel))) : new Set();
}

export function unmovedHandWrites(root, rels) {
  const moved = identicalRenames(root, rels);
  return rels.filter((rel) => !moved.has(rel));
}

/** True when every change under `pathspec` (repo-relative) is an unchanged R100 rename destination, and nothing there is untracked. */
export function onlyIdenticalRenames(root, pathspec) {
  const changed = gitTry(['diff', '--name-only', '-z', 'HEAD', '--', pathspec], root);
  const untracked = gitTry(['ls-files', '--others', '--exclude-standard', '-z', '--', pathspec], root);
  if (!changed.ok || !untracked.ok || untracked.out.split('\0').some(Boolean)) return false;
  const paths = changed.out.split('\0').filter(Boolean);
  return identicalRenames(root, paths).size === paths.length;
}
