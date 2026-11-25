// q-scan-path.mjs — `q code <text> --path <p>` where <p> exists on disk but the index holds no file at or under it
// (a gitignored log, build output, a file type the index skips): <p> is scanned on demand as `--dir` does
// (q-scan-dir), and answer paths stay relative to the repo root (KIT-T1563).
//
//   scanPathRows(abs, root, search) -> rows; search(index) answers the query over the scanned index.
//     A hit answers as the index would; an empty or cut-short scan carries the scan summary, marked `scanned`.

import { resolve } from 'node:path';
import { dirIndex, scanSummary } from './q-scan-dir.mjs';

const posix = (p) => p.replace(/\\/g, '/');

export async function scanPathRows(abs, root, search) {
  const scanned = dirIndex(abs);
  const base = `${posix(resolve(root))}/`;
  const hits = (await search(scanned)).filter((r) => r.loc).map((r) => (r.loc.startsWith(base) ? { ...r, loc: r.loc.slice(base.length) } : r));
  const note = { loc: '', text: scanSummary(abs, scanned), scanned: true };
  return hits.length && !scanned.truncated ? hits : [...hits, note];
}
