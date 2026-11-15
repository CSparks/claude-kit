// Dedup check for `t decide` (KIT-T1225, KIT-T1233): the proposal's title is ranked against the store's decisions with
// q's `similar` (FTS bm25); the related ones print before the write. A near-duplicate refuses it unless the draft
// supersedes that decision or `--not-dup` names it as read. A cache-less answer carries no score and never refuses.
// Only the title is ranked: a summary lengthens the query and lifts every score. Near means a high score AND subject words in
// common: three subject words shared, two of them not common to the store; function words, generic work words (built, plan,
// first, starts) and the store's own common words count for nothing (t-decide-terms.mjs).
//
//   decisionHits(root, { title }, q?) -> [{ id, status, title, score, near }]   best first, at most LISTED
//   dedupVerdict(root, draft, { notDup, supersedes }, q?) -> { lines, refusal }   `refusal` is empty unless a near-duplicate stands

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { query } from './q-lib.mjs';
import { readIdConfig } from './id-utils.mjs';
import { commonTerms, subjectTerms } from './t-decide-terms.mjs';

// Measured on a store holding a re-recorded ruling: it scored 39 by title and shared integrated and system; related, different decisions scored 15-28.
export const RELATED_SCORE = 15;
export const NEAR_SCORE = 35;
export const RELATED_SHARED_TERMS = 2;
export const NEAR_SUBJECT_TERMS = 3;
export const NEAR_SHARED_TERMS = 2;
export const LISTED = 5;
const RETIRED = /supersed|reject|retired/i;
const TITLE_LINE = /^title:[ \t]*(.+)$/m;

function storeTitles(root) {
  const dir = join(root, '.ai', 'decisions');
  try {
    return readdirSync(dir).filter((name) => name.endsWith('.md')).map((name) => (readFileSync(join(dir, name), 'utf8').match(TITLE_LINE) || [])[1] || '');
  } catch {
    return [];
  }
}

const sharedTerms = (a, b) => [...a].filter((t) => b.has(t)).length;

export async function decisionHits(root, { title }, q = query) {
  try {
    const { key } = readIdConfig(root);
    const { rows } = await q('similar', ['--store', 'decisions', ...(key ? ['--scopes', key] : []), title], { root });
    const common = commonTerms(storeTitles(root));
    const mine = subjectTerms(title);
    const mineDistinct = subjectTerms(title, common);
    return rows
      .filter((r) => !RETIRED.test(r.status || '') && Number(r.score) >= RELATED_SCORE)
      .map((r) => ({ id: r.id, status: r.status || '', title: r.title, score: Number(r.score), related: sharedTerms(mine, subjectTerms(r.title)), distinct: sharedTerms(mineDistinct, subjectTerms(r.title, common)) }))
      .filter((r) => r.related >= RELATED_SHARED_TERMS)
      .map(({ related, distinct, ...r }) => ({ ...r, near: r.score >= NEAR_SCORE && related >= NEAR_SUBJECT_TERMS && distinct >= NEAR_SHARED_TERMS }))
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
