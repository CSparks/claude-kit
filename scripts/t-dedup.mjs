// Dedup gate for `t new` (KIT-T353, KIT-T025): rank the title against the target store with
// q's `similar` (FTS bm25) and report the OPEN items that look like the same work.
//
// An item is a duplicate candidate when its bm25 score reaches DEDUP_SCORE AND its title shares
// at least MIN_SHARED_TERMS title terms with the proposal. Calibrated on the stiletto-2349 store
// (2026-10-13): the ST-T892/ST-T839 pair scores 25.2, a reworded repeat of an existing title
// scores 33-40, genuinely new titles score 8-15. A cache-less answer carries no score and never
// refuses (fail-open).

import { query } from './q-lib.mjs';
import { readIdConfig } from './id-utils.mjs';
import { ALNUM_TERM, MIN_TERM_LEN, OPEN } from './q-model.mjs';

export const DEDUP_SCORE = 20;
export const MIN_SHARED_TERMS = 2;
export const DEDUP_LISTED = 3;

const termsOf = (text) => new Set((String(text || '').toLowerCase().match(ALNUM_TERM) || []).filter((t) => t.length > MIN_TERM_LEN));

export async function findDuplicates(root, title, q = query) {
  try {
    const { key } = readIdConfig(root);
    const args = ['--store', 'tickets', ...(key ? ['--scopes', key] : []), title];
    const { rows } = await q('similar', args, { root });
    const mine = termsOf(title);
    return rows
      .filter((r) => OPEN.includes(r.status) && Number(r.score) >= DEDUP_SCORE)
      .filter((r) => [...termsOf(r.title)].filter((t) => mine.has(t)).length >= MIN_SHARED_TERMS)
      .slice(0, DEDUP_LISTED);
  } catch {
    return [];
  }
}

export function refusal(title, hits) {
  return [
    `t new: refusing — ${hits.length} open ticket(s) look like the same work as "${title}":`,
    ...hits.map((h) => `  ${h.id} [${h.status}] ${h.title}`),
    'Read them. Same work: comment on or extend the existing ticket instead.',
    'Genuinely different: re-run with --not-dup <id,...> naming the items you checked (recorded in the new ticket\'s Notes).',
  ].join('\n');
}
