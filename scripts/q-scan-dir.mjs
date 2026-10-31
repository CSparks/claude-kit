// `q code <text> --dir <path>`: search a directory or file outside the code index (logs, build output,
// gitignored files, an unregistered checkout). Same records as the index, so ranking, -c, -l and clipping
// match; answer paths are absolute.
//
//   dirIndex(target) -> { handle: null, files: [{ rel, abs, kind, lang }], scanned, skipped: [{ rel, reason }] }
//   scanSummary(target, index) -> the line an empty answer carries: files read, files skipped and why

import { closeSync, openSync, readSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { classify } from './code-index-extract.mjs';

const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_FILES = 50_000;
const SNIFF_BYTES = 4096;
const SKIPPED_SHOWN = 3;
const SKIP = new Set(['.git', 'node_modules', '.cache']);

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

function* walk(abs) {
  let entries;
  try { entries = readdirSync(abs, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const child = join(abs, e.name);
    if (e.isDirectory() && !e.isSymbolicLink()) yield* walk(child);
    else if (e.isFile()) yield child;
  }
}

export function dirIndex(target) {
  const base = resolve(target);
  let st;
  try { st = statSync(base); } catch { throw new Error(`q --dir: ${base} does not exist`); }
  const paths = st.isFile() ? [base] : [...walk(base)];
  const files = [];
  const skipped = [];
  for (const abs of paths) {
    const rel = abs.replace(/\\/g, '/');
    if (files.length >= MAX_FILES) { skipped.push({ rel, reason: 'file limit' }); continue; }
    let size;
    try { size = statSync(abs).size; } catch { skipped.push({ rel, reason: 'unreadable' }); continue; }
    if (size > MAX_FILE_BYTES) { skipped.push({ rel, reason: 'too large' }); continue; }
    if (looksBinary(abs)) { skipped.push({ rel, reason: 'binary' }); continue; }
    const cls = classify(rel) || { kind: 'code', lang: 'text' };
    files.push({ rel, abs, kind: cls.kind === 'config' ? 'code' : cls.kind, lang: cls.lang });
  }
  return { handle: null, files, scanned: files.length, skipped };
}

export function scanSummary(target, index) {
  const { scanned, skipped } = index;
  const base = `searched ${scanned} file${scanned === 1 ? '' : 's'} under ${resolve(target).replace(/\\/g, '/')}`;
  if (!skipped.length) return base;
  const names = skipped.slice(0, SKIPPED_SHOWN).map((k) => `${k.rel.split('/').pop()} (${k.reason})`).join(', ');
  return `${base}; NOT read: ${skipped.length} (${names}${skipped.length > SKIPPED_SHOWN ? ', …' : ''})`;
}
