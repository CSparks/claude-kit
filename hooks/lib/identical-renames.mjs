// A byte-identical rename (KIT-T991): a path git has staged as the destination of an R100 rename whose working-tree
// content still equals the staged blob. A move authors nothing, so neither hand-write-detect nor commit-gate's
// hand-write ledger holds it for an Edit or Write re-save.
//
//   identicalRenames(root, rels) -> Set of the paths in `rels` that are unchanged R100 rename destinations
//   unmovedHandWrites(root, rels) -> `rels` without those paths
//   onlyIdenticalRenames(root, pathspec) -> true when nothing under `pathspec` changed except by such renames

import { gitTry } from './exec.mjs';

const IDENTICAL = 'R100';
const SCORED_STATUS = /^[RC]\d+$/;
const RAW_META = /^:(\d+) (\d+) ([0-9a-f]+) ([0-9a-f]+) (\S+)$/;

/**
 * Destination paths of the renames in `git diff --raw -z` output whose status is R100 AND whose source and destination
 * entries carry the same blob id and mode: git's score is never trusted alone.
 */
export function identicalRenameTargets(raw) {
  const parts = String(raw).split('\0');
  const renames = new Set();
  for (let i = 0; i < parts.length; i++) {
    const meta = RAW_META.exec(parts[i]);
    if (!meta) continue;
    const [, oldMode, newMode, oldId, newId, status] = meta;
    if (!SCORED_STATUS.test(status)) { i += 1; continue; }
    if (status === IDENTICAL && oldMode === newMode && oldId === newId) renames.add(parts[i + 2]);
    i += 2;
  }
  return renames;
}

const stagedIdenticalRenames = (root) => {
  const listing = gitTry(['diff', '--cached', '-M', '--raw', '--no-abbrev', '-z'], root);
  return listing.ok ? identicalRenameTargets(listing.out) : new Set();
};

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
