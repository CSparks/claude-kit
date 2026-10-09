// items-cache.mjs — collectItems() answered from a stat-keyed cache.
//
// The markdown-scan fallback (governing, mentions, drift, topics, and every verb when no SQLite
// engine exists) parses every store file; at ~1,000 files that is ~1 s, mostly file opens.
// This returns the SAME rows as db-parse's collectItems but re-parses only files whose
// (mtime, size) changed since the last run, so an unchanged store is a stat pass.

import { join } from 'node:path';
import { rowFromScan } from './db-parse.mjs';
import { idFromFilename, readIdConfig, statStoreFiles } from './id-utils.mjs';
import { pathKey, statCached } from '../hooks/lib/stat-cache.mjs';

export function collectItemsCached(root, aiDir = join(root, '.ai')) {
  const { key } = readIdConfig(root, aiDir);
  const entries = statStoreFiles(aiDir);
  const byRel = new Map(entries.map((e) => [e.relpath, e]));
  const files = entries.map((e) => ({ path: e.relpath, mtimeMs: e.mtimeMs, size: e.size }));
  return statCached(`items-${pathKey(aiDir)}-${key}`, files, (relpath) => {
    const e = byRel.get(relpath);
    return rowFromScan(aiDir, { sub: e.sub, file: e.file, store: e.store, id: idFromFilename(e.file) }, key);
  });
}
