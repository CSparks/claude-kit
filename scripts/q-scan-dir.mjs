// `q code <text> --dir <path>`: search a directory or file outside the code index (logs, build output,
// gitignored files, an unregistered checkout). Same records as the index, so ranking, -c, -l and clipping
// match; answer paths are absolute.
//
//   dirIndex(target) -> { handle: null, files: [{ rel, abs, kind, lang }], scanned }

import { closeSync, openSync, readSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { classify } from './code-index-extract.mjs';

const MAX_FILE_BYTES = 40 * 1024 * 1024;
const MAX_FILES = 50_000;
const SNIFF_BYTES = 4096;
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
  for (const abs of paths) {
    if (files.length >= MAX_FILES) break;
    let size;
    try { size = statSync(abs).size; } catch { continue; }
    if (size > MAX_FILE_BYTES || looksBinary(abs)) continue;
    const rel = abs.replace(/\\/g, '/');
    const cls = classify(rel) || { kind: 'code', lang: 'text' };
    files.push({ rel, abs, kind: cls.kind === 'config' ? 'code' : cls.kind, lang: cls.lang });
  }
  return { handle: null, files, scanned: files.length };
}
