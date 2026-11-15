// The words a decision-title comparison counts (KIT-T1233). Words every title carries say nothing about the subject:
// English function words, generic work words (built, plan, first, starts) and, in a store of enough decisions, the words
// a large share of its titles hold. A word is compared in its singular stem.
//
//   termsOf(text)               -> Set of stems, function words dropped, generic words kept
//   subjectTerms(text, common?) -> Set of stems with generic words and the store's `common` stems dropped
//   commonTerms(titles)         -> Set of stems held by more than COMMON_SHARE of the titles; empty under MIN_TITLES titles

import { ALNUM_TERM, MIN_TERM_LEN } from './q-model.mjs';

export const COMMON_SHARE = 0.15;
export const MIN_TITLES = 20;

const FUNCTION_WORDS = new Set(`the and for are but not with from that this these those into onto over under about after before
  until while when where which what who whom whose how why can could should would will shall may might must does did has have had
  was were been being than then them they their there here its our your his her she him you any all each every both either
  other another such only own same also just very more most less least per via one two three never always`.split(/\s+/));

const GENERIC_WORDS = new Set(`build builds built building plan plans planned first start starts started starting step steps
  make makes made use uses used using work works working new old own way ways thing things rule rules ruling decision
  decisions every owed unbuilt later now next last`.split(/\s+/));

const stem = (word) => (word.length > MIN_TERM_LEN + 1 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word);

export const termsOf = (text) => new Set((String(text || '').toLowerCase().match(ALNUM_TERM) || [])
  .filter((t) => t.length > MIN_TERM_LEN && !FUNCTION_WORDS.has(t))
  .map(stem));

export const subjectTerms = (text, common = new Set()) => new Set([...termsOf(text)].filter((t) => !GENERIC_WORDS.has(t) && !common.has(t)));

export function commonTerms(titles) {
  if (titles.length < MIN_TITLES) return new Set();
  const held = new Map();
  for (const title of titles) for (const term of termsOf(title)) held.set(term, (held.get(term) || 0) + 1);
  return new Set([...held].filter(([, n]) => n / titles.length > COMMON_SHARE).map(([term]) => term));
}
