// cap's dedup hint (KIT-T025 search, KIT-T279): before a capture is written, list likely
// existing tickets in the target project store AND its adopted framework store, so a capture
// of an already-ticketed idea is caught at the receipt. Suggest-only and fail-open — a search
// failure or an unkeyed store yields no lines; it never blocks the write. Ids the caller already
// checked (`cap --not-dup`) are left out.
//
// The search reads the markdown store, never the shared SQLite cache: a hint nobody needs must not
// wait on a write lock another session holds (stacked lock waits ran a capture for minutes, KIT-T1040).

import { createHash } from 'node:crypto';
import { realpathSync } from 'node:fs';
import { dirname, basename, join } from 'node:path';
import { query } from './q-lib.mjs';
import { frameworkStores } from './q-framework.mjs';
import { readIdConfig } from './id-utils.mjs';

const MAX_HINTS = 5;
const MIN_TEXT_CHARS = 3;
const SHAPE_HASH_CHARS = 8;

/** The dedup key of a kit capture: the readable slug plus a digest of the whole normalized text, so two captures that only share an opening phrase are two tickets. */
export function captureShape(kind, slug, text) {
  const words = String(text).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  return `cap:${kind}:${slug}:${createHash('sha1').update(words).digest('hex').slice(0, SHAPE_HASH_CHARS)}`;
}

/** Receipt lines naming likely duplicates of `text` for the store at `aiDir` (+ frameworks). */
export async function dedupHints(aiDir, text, { skip = [] } = {}) {
  try {
    if (String(text).trim().length < MIN_TEXT_CHARS) return [];
    const inRepo = basename(aiDir) === '.ai';
    const root = inRepo ? dirname(aiDir) : undefined;
    const { key } = readIdConfig(root || aiDir, aiDir);
    if (!key) return [];
    const scopes = [key, ...(root ? frameworkStores(root).map((f) => f.scope) : [])];
    const found = await query('similar', ['--store', 'tickets', '--scopes', scopes.join(','), text], { root, noDb: true });
    const rows = found.rows.filter((r) => !skip.includes(r.id));
    if (!rows.length) return [];
    return [
      `  possible duplicate${rows.length > 1 ? 's' : ''} (the capture below is filed, not refused; link or supersede if one is the same work):`,
      ...rows.slice(0, MAX_HINTS).map((r) => `    ${r.id} [${r.status}] ${r.title}`),
    ];
  } catch {
    return [];
  }
}

/** Receipt lines for lapsed tickets this capture reopened (KIT-D107); [] for a central store or any failure. */
export async function reopenedLines(aiDir, text, skip = []) {
  try {
    if (basename(aiDir) !== '.ai') return [];
    const { reopenOnCollision } = await import('./lapsed-reopen.mjs');
    return await reopenOnCollision(dirname(aiDir), text, { skip });
  } catch {
    return [];
  }
}

/**
 * A `bug` or `feature` capture aimed at the kit's own store becomes a kit-bug / kit-feature ticket: { id, created }, or
 * null when the destination is any other store (then it lands in the inbox as usual).
 */
export async function asKitBug(aiDir, text, slug, kind = 'bug', notDup = []) {
  try {
    const { kitStoreRoot, fileKitBug } = await import('./kit-bug.mjs');
    const kit = kitStoreRoot();
    if (!kit || realpathSync.native(join(kit, '.ai')).toLowerCase() !== realpathSync.native(aiDir).toLowerCase()) return null;
    const checked = notDup.length ? `\n\nChecked as possible duplicates and judged different work (--not-dup): ${notDup.join(', ')}` : '';
    return fileKitBug({ shape: captureShape(kind, slug, text), title: text, detail: `${text}${checked}`, project: basename(process.cwd()), kind, repeatAsk: true });
  } catch {
    return null;
  }
}
