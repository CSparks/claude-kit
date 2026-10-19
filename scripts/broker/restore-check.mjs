// restore-check.mjs — the verdict on a tree after a job's restore (KIT-T572). A mismatch is a fault with
// words: which path, and whether only its line endings or its content differs, so the banner can be
// judged at a glance; a clean restore stamps the time, which resolves earlier restore-mismatch faults.
//
//   describeMismatches(journal) -> one line per path that differs from the journal's pre-image
//   checkRestore(cfg, journal, id)  record the fault (with those lines) or the clean stamp

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { catBlob } from './git.mjs';
import { recordFault, recordRestoreClean } from './health-store.mjs';
import { restoreMismatches } from './preimage.mjs';

const CRLF = new RegExp(String.fromCharCode(13, 10), 'g');
const LF = String.fromCharCode(10);

function describe(cwd, path, blob) {
  const abs = join(cwd, path);
  if (blob === null) return `${path}: created by the job and still there`;
  const want = catBlob(cwd, blob);
  if (!existsSync(abs) || !want) return `${path}: missing after the restore (journal has it)`;
  const have = readFileSync(abs);
  const [a, b] = [want.toString('utf8').replace(CRLF, LF), have.toString('utf8').replace(CRLF, LF)];
  if (a === b) return `${path}: line endings only (${have.length} bytes, journal ${want.length})`;
  const [la, lb] = [a.split(LF), b.split(LF)];
  const line = la.findIndex((l, i) => l !== lb[i]);
  return `${path}: content differs, first at line ${(line === -1 ? Math.min(la.length, lb.length) : line) + 1} (${have.length} bytes, journal ${want.length})`;
}

export function describeMismatches(journal) {
  const off = new Set(restoreMismatches(journal));
  return journal.entries.filter((e) => off.has(e.path)).map((e) => describe(journal.cwd, e.path, e.blob));
}

export function checkRestore(cfg, journal, id) {
  const lines = describeMismatches(journal);
  if (!lines.length) { recordRestoreClean(cfg); return; }
  const off = new Set(restoreMismatches(journal));
  recordFault(cfg, { kind: 'restore-mismatch', id, detail: `after the restore: ${lines.join('; ')}`, recheck: { cwd: journal.cwd, entries: journal.entries.filter((e) => off.has(e.path)) } });
}
