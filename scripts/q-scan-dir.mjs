// `q code <text> --dir <path>`: search a directory or file outside the code index (logs, build output,
// gitignored files, a plain directory). Same records as the index, so ranking, -c, -l and clipping
// match; answer paths are absolute. A directory inside a git work tree is answered from that
// checkout's index instead (q-dir-target.mjs), so this scan never meets a source tree.
//
//   dirIndex(target) -> { handle: null, files: [{ rel, abs, kind, lang }], scanned, skipped: [{ rel, reason }], truncated, buildDirs }
//   scanSummary(target, index) -> the line an empty or cut-short answer carries: files read, files skipped and why
//
// The scan stops after SCAN_BUDGET_MS or MAX_FILES (`truncated`): a directory too big to read in that
// time is narrowed by the caller, never waited on. Build-output directories below the target are not
// entered (`buildDirs` names them); naming one as the target scans it.

import { closeSync, openSync, readSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { classify } from './code-index-extract.mjs';

const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_FILES = 50_000;
const SNIFF_BYTES = 4096;
const SKIPPED_SHOWN = 3;
export const MS_PER_SECOND = 1000;
export const SCAN_BUDGET_MS = 20_000;
const SKIP = new Set(['.git', 'node_modules', '.cache']);
const BUILD_DIRS = new Set(['target', '.venv', '__pycache__']);

function looksBinary(abs) {
  let fd;
  try {
    fd = openSync(abs, 'r');
    const buf = Buffer.alloc(SNIFF_BYTES);
    const n = readSync(fd, buf, 0, SNIFF_BYTES, 0);
    return buf.subarray(0, n).includes(0);
  } catch {
    return true;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

function* walk(abs, buildDirs) {
  let entries;
  try { entries = readdirSync(abs, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const child = join(abs, e.name);
    if (e.isDirectory() && BUILD_DIRS.has(e.name)) buildDirs.add(e.name);
    else if (e.isDirectory() && !e.isSymbolicLink()) yield* walk(child, buildDirs);
    else if (e.isFile()) yield child;
  }
}

export function dirIndex(target, budgetMs = SCAN_BUDGET_MS) {
  const base = resolve(target);
  let st;
  try { st = statSync(base); } catch { throw new Error(`q --dir: ${base} does not exist`); }
  const buildDirs = new Set();
  const paths = st.isFile() ? [base] : walk(base, buildDirs);
  const files = [];
  const skipped = [];
  const deadline = Date.now() + budgetMs;
  let truncated = false;
  for (const abs of paths) {
    if (Date.now() > deadline || files.length >= MAX_FILES) { truncated = true; break; }
    const rel = abs.replace(/\\/g, '/');
    let size;
    try { size = statSync(abs).size; } catch { skipped.push({ rel, reason: 'unreadable' }); continue; }
    if (size > MAX_FILE_BYTES) { skipped.push({ rel, reason: 'too large' }); continue; }
    if (looksBinary(abs)) { skipped.push({ rel, reason: 'binary' }); continue; }
    const cls = classify(rel) || { kind: 'code', lang: 'text' };
    files.push({ rel, abs, kind: cls.kind === 'config' ? 'code' : cls.kind, lang: cls.lang });
  }
  return { handle: null, files, scanned: files.length, skipped, truncated, buildDirs: [...buildDirs], budgetMs };
}

export function scanSummary(target, index) {
  const { scanned, skipped, truncated, buildDirs = [], budgetMs = SCAN_BUDGET_MS } = index;
  const where = resolve(target).replace(/\\/g, '/');
  const parts = [`searched ${scanned} file${scanned === 1 ? '' : 's'} under ${where}`];
  if (!scanned && !truncated) parts.push('no readable files there (a relative --dir resolves against the current directory)');
  if (truncated) parts.push(`STOPPED at ${budgetMs / MS_PER_SECOND} s or ${MAX_FILES} files: too big to read whole, so "no results" proves nothing; name a subdirectory or file`);
  if (buildDirs.length) parts.push(`not entered: ${buildDirs.join(', ')} (name one as the target to scan it)`);
  if (skipped.length) {
    const names = skipped.slice(0, SKIPPED_SHOWN).map((k) => `${k.rel.split('/').pop()} (${k.reason})`).join(', ');
    parts.push(`NOT read: ${skipped.length} (${names}${skipped.length > SKIPPED_SHOWN ? ', …' : ''})`);
  }
  return parts.join('; ');
}
