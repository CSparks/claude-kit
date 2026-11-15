// Dedup check for `t decide` (KIT-T1225): the proposal's title and summary are ranked against the store's decisions with
// q's `similar` (FTS bm25); the related ones print before the write. A near-duplicate refuses it unless the draft
// supersedes that decision or `--not-dup` names it as read. A cache-less answer carries no score and never refuses.
//
//   decisionHits(root, { title, summary }, q?) -> [{ id, status, title, score, near }]   best first, at most LISTED
//   dedupVerdict(root, draft, { notDup, supersedes }, q?) -> { lines, refusal }   `refusal` is empty unless a near-duplicate stands

import { query } from './q-lib.mjs';
import { readIdConfig } from './id-utils.mjs';
import { ALNUM_TERM, MIN_TERM_LEN } from './q-model.mjs';

// Measured on a store holding a re-recorded ruling: it scored 39 and shared five title terms; related, different decisions scored 15-28.
export const RELATED_SCORE = 15;
export const NEAR_SCORE = 35;
export const RELATED_SHARED_TERMS = 2;
export const NEAR_SHARED_TERMS = 3;
export const LISTED = 5;
const RETIRED = /supersed|reject|retired/i;

const termsOf = (text) => new Set((String(text || '').toLowerCase().match(ALNUM_TERM) || []).filter((t) => t.length > MIN_TERM_LEN));
const sharedTerms = (a, b) => [...a].filter((t) => b.has(t)).length;

export async function decisionHits(root, { title, summary = '' }, q = query) {
  try {
    const { key } = readIdConfig(root);
    const proposal = [title, summary].filter(Boolean).join('. ');
    const { rows } = await q('similar', ['--store', 'decisions', ...(key ? ['--scopes', key] : []), proposal], { root });
    const mine = termsOf(proposal);
    return rows
      .filter((r) => !RETIRED.test(r.status || '') && Number(r.score) >= RELATED_SCORE)
      .map((r) => ({ id: r.id, status: r.status || '', title: r.title, score: Number(r.score), shared: sharedTerms(mine, termsOf(r.title)) }))
      .filter((r) => r.shared >= RELATED_SHARED_TERMS)
      .map(({ shared, ...r }) => ({ ...r, near: r.score >= NEAR_SCORE && shared >= NEAR_SHARED_TERMS }))
      .slice(0, LISTED);
  } catch {
    return [];
  }
}

const idsOf = (text) => String(text || '').split(/[\s,]+/).filter(Boolean);

export async function dedupVerdict(root, draft, { notDup = [], supersedes = '' } = {}, q = query) {
  const hits = await decisionHits(root, draft, q);
  if (!hits.length) return { lines: [], refusal: '' };
  const addressed = new Set([...notDup, ...idsOf(supersedes), ...idsOf(draft.supersedes)]);
  const open = hits.filter((h) => h.near && !addressed.has(h.id));
  const lines = ['t decide: earlier decisions that look related (read them: q show <id>):', ...hits.map((h) => `  ${h.id}${h.near ? ' [near-duplicate]' : ''} ${h.title}`)];
  const refusal = open.length
    ? [
      `t decide: refusing — ${open.map((h) => h.id).join(', ')} look(s) like the same ruling as "${draft.title}".`,
      'Same ruling: it is already recorded; build it or revise it (t revise <id>) instead of recording it again.',
      'It replaces or sharpens an earlier one: re-run with --supersedes <id> (or supersedes: in the draft).',
      'Genuinely different: re-run with --not-dup <id,...> naming the decisions you read.',
    ].join('\n')
    : '';
  return { lines, refusal };
}
