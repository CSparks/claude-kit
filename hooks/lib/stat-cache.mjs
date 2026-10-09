// stat-cache.mjs — memoize a per-file computation across processes, keyed on (mtime, size).
//
// Opening a file costs ~0.4 ms on a Windows dev box regardless of size, so scanning ~1,000
// store files at every SessionStart costs ~0.4 s per scan; a stat costs ~0.01 ms. A hook that
// only needs derived facts from each file calls statCached(): unchanged files are answered from
// the on-disk cache without being opened, changed files are recomputed, vanished files are
// dropped. FAIL-OPEN: an unreadable or corrupt cache degrades to computing every file.
//
//   const values = statCached('ticket-heads-<hash>', files, (path) => parse(path));
//     files   [{ path, mtimeMs, size }]  — the caller stats the directory (cheap)
//     compute (path) -> JSON-serializable value
//     returns one value per file, in `files` order
//
// The cache lives in $CLAUDE_KIT_CACHE_DIR, else <plugin root>/.cache (gitignored), one JSON
// file per name, written atomically (tmp + rename) only when something changed.

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT_ROOT = dirname(dirname(dirname(fileURLToPath(import.meta.url))));

export function cacheDir() {
  return process.env.CLAUDE_KIT_CACHE_DIR || join(process.env.CLAUDE_PLUGIN_ROOT || KIT_ROOT, '.cache');
}

/** Short stable hash of a path, for naming a per-root cache file. */
export function pathKey(p) {
  return createHash('sha1').update(String(p).replace(/\\/g, '/').toLowerCase()).digest('hex').slice(0, 12);
}

function readCache(file) {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(file, data) {
  try {
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, JSON.stringify(data));
    renameSync(tmp, file);
  } catch {
    /* cache is an accelerator — a failed write only costs the next run a recompute */
  }
}

export function statCached(name, files, compute) {
  const file = join(cacheDir(), `${name}.json`);
  const cached = readCache(file);
  const next = {};
  let dirty = Object.keys(cached).length !== files.length;
  const values = files.map((f) => {
    const hit = cached[f.path];
    if (hit && hit.m === f.mtimeMs && hit.s === f.size) {
      next[f.path] = hit;
      return hit.v;
    }
    const v = compute(f.path);
    next[f.path] = { m: f.mtimeMs, s: f.size, v };
    dirty = true;
    return v;
  });
  if (dirty) writeCache(file, next);
  return values;
}

/** Stat every `.md` directly under `dir` (no content reads). [] when the dir is unreadable. */
export function statMarkdownFiles(dir, skip = () => false) {
  const out = [];
  let names;
  try { names = readdirSync(dir); } catch { return out; }
  for (const name of names) {
    if (!name.endsWith('.md') || skip(name)) continue;
    const path = join(dir, name);
    try {
      const st = statSync(path);
      out.push({ path, name, mtimeMs: st.mtimeMs, size: st.size });
    } catch {
      /* raced with a delete */
    }
  }
  return out;
}
