// cap's dedup hint (KIT-T025 search, KIT-T279): before a capture is written, list likely
// existing tickets in the target project store AND its adopted framework store, so a capture
// of an already-ticketed idea is caught at the receipt. Suggest-only and fail-open — a search
// failure or an unkeyed store yields no lines; it never blocks the write.

import { realpathSync } from 'node:fs';
import { dirname, basename, join } from 'node:path';
import { query } from './q.mjs';
import { frameworkStores } from './q-framework.mjs';
import { readIdConfig } from './id-utils.mjs';

const MAX_HINTS = 5;
const MIN_TEXT_CHARS = 3;

/** Receipt lines naming likely duplicates of `text` for the store at `aiDir` (+ frameworks). */
export async function dedupHints(aiDir, text) {
  try {
    if (String(text).trim().length < MIN_TEXT_CHARS) return [];
    const inRepo = basename(aiDir) === '.ai';
    const root = inRepo ? dirname(aiDir) : undefined;
    const { key } = readIdConfig(root || aiDir, aiDir);
    if (!key) return [];
    const scopes = [key, ...(root ? frameworkStores(root).map((f) => f.scope) : [])];
    const { rows } = await query('similar', ['--store', 'tickets', '--scopes', scopes.join(','), text], { root });
    if (!rows.length) return [];
    return [
      `  possible duplicate${rows.length > 1 ? 's' : ''} (link or supersede instead of a new ticket):`,
      ...rows.slice(0, MAX_HINTS).map((r) => `    ${r.id} [${r.status}] ${r.title}`),
    ];
  } catch {
    return [];
  }
}

/**
 * A `bug` or `feature` capture aimed at the kit's own store becomes a kit-bug / kit-feature ticket: { id, created }, or
 * null when the destination is any other store (then it lands in the inbox as usual).
 */
export async function asKitBug(aiDir, text, slug, kind = 'bug') {
  try {
    const { kitStoreRoot, fileKitBug } = await import('./kit-bug.mjs');
    const kit = kitStoreRoot();
    if (!kit || realpathSync.native(join(kit, '.ai')).toLowerCase() !== realpathSync.native(aiDir).toLowerCase()) return null;
    return fileKitBug({ shape: `cap:${kind}:${slug}`, title: text, detail: text, project: basename(process.cwd()), kind });
  } catch {
    return null;
  }
}
