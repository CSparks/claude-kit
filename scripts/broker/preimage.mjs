// preimage.mjs — the check-only restore journal (KIT-T276). Before a patch touches the live
// tree, each touched path's exact bytes go into the git object database and the list into
// `<broker home>/inflight.json`; afterwards (or after a crash, at the next start) every path is
// put back byte for byte and files the patch created are removed.

import { existsSync, mkdirSync, readFileSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { catBlob, hashObject, lockFiles } from './git.mjs';

const journalPath = (cfg) => join(brokerPaths(cfg).home, 'inflight.json');

/** Record the pre-image of `paths` (relative to `cwd`) and return the journal. */
export function capture(cfg, { id, cwd, paths }) {
  const entries = paths.map((path) => ({ path, blob: existsSync(join(cwd, path)) ? hashObject(cwd, path) : null }));
  const journal = { id, cwd, startedAt: new Date().toISOString(), entries };
  writeFileSync(journalPath(cfg), JSON.stringify(journal, null, 2));
  return journal;
}

function pruneEmptyDirs(from, stop) {
  for (let d = from; d.length > stop.length && d.startsWith(stop); d = dirname(d)) {
    try { rmdirSync(d); } catch { return; }
  }
}

/** Put every journalled path back and drop the journal. */
export function restore(cfg, journal) {
  for (const { path, blob } of journal.entries) {
    const abs = join(journal.cwd, path);
    if (blob) {
      mkdirSync(dirname(abs), { recursive: true });
      writeFileSync(abs, catBlob(journal.cwd, blob));
    } else {
      rmSync(abs, { force: true });
      pruneEmptyDirs(dirname(abs), journal.cwd);
    }
  }
  rmSync(journalPath(cfg), { force: true });
}

/** Paths whose bytes differ from the journal's pre-image (call after `restore`). */
export function restoreMismatches(journal) {
  return journal.entries
    .filter(({ path, blob }) => (existsSync(join(journal.cwd, path)) ? hashObject(journal.cwd, path) : null) !== blob)
    .map(({ path }) => path);
}

/** Drop the journal without restoring: the tree now matches a commit. */
export function discard(cfg) {
  rmSync(journalPath(cfg), { force: true });
}

/** The unfinished journal a crash left, or null. */
export function readInflight(cfg) {
  try { return JSON.parse(readFileSync(journalPath(cfg), 'utf8')); } catch { return null; }
}

/** Restore from a crash's journal; returns the job id it belonged to, or null. */
export function recoverInflight(cfg) {
  const journal = readInflight(cfg);
  if (!journal) return null;
  restore(cfg, journal);
  return journal.id;
}

/** Remove every Cargo.lock that was not in `before`: a run created it. */
export function dropNewLocks(cwd, before) {
  for (const p of lockFiles(cwd)) if (!before.includes(p)) rmSync(join(cwd, p), { force: true });
}

/**
 * Run `fn` and leave every Cargo.lock of `cwd` as found, dirty or not: cargo rewrites locks as a
 * side effect of any build or test. For runs outside a job's own journal (idle re-checks).
 */
export function guardLocks(cfg, { id, cwd }, fn) {
  const before = lockFiles(cwd);
  const journal = capture(cfg, { id, cwd, paths: before });
  try { return fn(); } finally { restore(cfg, journal); dropNewLocks(cwd, before); }
}
