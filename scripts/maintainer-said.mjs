// maintainer-said.mjs — the maintainer's own comments that sit under a decision (KIT-T844). A decision is
// read at dispatch and in the handoff brief; a later ticket comment from the maintainer that rejects its
// subject never reaches that read unless something carries it there. A comment counts for a decision when it
// is authored by the maintainer, is dated on or after the decision, and either names the decision id or shares
// MIN_SHARED_TERMS words with the decision's title.
//
//   maintainerSaid(decision, comments, user?) -> [{ ref, ts, text, objection }]   best match first
//     comments: collectComments(items) rows { ref, ts, author, text }
//   isObjection(text) -> true when the words read as a rejection (literal, not a judge: a false positive
//     costs one line of the maintainer's attention, a false negative costs a dispatch onto a rejected plan)

import { resolveUser } from './identity.mjs';

const MIN_SHARED_TERMS = 3;
const MIN_TERM_CHARS = 2;
const STOP = new Set(['the', 'an', 'and', 'or', 'of', 'to', 'in', 'on', 'for', 'with', 'at', 'by', 'is', 'are', 'be', 'use', 'uses', 'now', 'not', 'no', 'it', 'that', 'this', 'than', 'from', 'as', 'all', 'any', 'has', 'have', 'its', 'there', 'then', 'when', 'was', 'were', 'but', 'can', 'will', 'you', 'out', 'one']);
const REJECTING_WORDS = /\b(didn'?t|did not|don'?t|do not|never|wrong|not what|stop|reject\w*|undo|revert\w*|instead of|I said)\b/i;
const SHOUTING = /\b[A-Z]{3,}\b(?:\W+\b[A-Z]{3,}\b){2,}|!{2,}/;
const MAINTAINER_ROLES = new Set(['maintainer', 'user']);

const termsOf = (text) => new Set(String(text || '').toLowerCase().match(/[a-z0-9]+/g)?.filter((w) => w.length >= MIN_TERM_CHARS && !STOP.has(w) && !/^\d+$/.test(w)) || []);

export const isObjection = (text) => REJECTING_WORDS.test(String(text || '')) || SHOUTING.test(String(text || ''));

export function maintainerSaid(decision, comments, user = resolveUser()) {
  if (!decision || !decision.id) return [];
  const born = (decision.history || [])[0]?.ts || '';
  const title = termsOf(decision.title);
  const idRe = new RegExp(`\\b${decision.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
  const who = new Set([String(user).toLowerCase(), ...MAINTAINER_ROLES]);
  const score = (c) => (idRe.test(c.text) ? Infinity : [...termsOf(c.text)].filter((w) => title.has(w)).length);
  return comments
    .filter((c) => who.has(String(c.author).toLowerCase()) && String(c.ts) >= born)
    .map((c) => ({ c, shared: score(c) }))
    .filter(({ shared }) => shared >= MIN_SHARED_TERMS)
    .sort((a, b) => b.shared - a.shared || String(a.c.ts).localeCompare(String(b.c.ts)))
    .map(({ c }) => ({ ref: c.ref, ts: c.ts, text: c.text, objection: isObjection(c.text) }));
}
