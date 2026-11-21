// brief-grounding — which recorded decisions does a dispatch brief centre on without naming (KIT-T1458)?
// A plan, analysis or perf brief describes work by topic; it seldom restates a ruling's clause, so the questionnaire's clause
// matcher misses it (RDG-D031, "every deterministic output is cached", went unread by a persistence plan that named a
// neighbouring decision). A brief's central words are its BRIEF_CENTRAL_STEMS stems of highest frequency times rarity (rarity
// over the store's decisions, a stem no decision holds never counts); a decision is a title's worth of topic, so it is a miss
// when at least BRIEF_TITLE_CENTRAL_MIN stems of its title are among those central words. A long brief touches many decisions
// in passing and shares most words with none of them as its topic, so only a decision the brief is about blocks. The brief's
// bracketed tags are cut first; the project store and the store of every framework the project uses are read. A decision is
// cleared only by naming its id anywhere in the brief (a [rulings-checked: ...] tag included). At most BRIEF_DECISIONS_TOP are
// returned, best first.
//
//   decisionStoreRoots(root)        -> [{ source: 'project' | <framework name>, root }] the stores whose decisions bind the brief
//   briefText(text)                 -> the brief without its bracketed tags
//   briefDecisionMisses(root, text) -> [{ id, title, source, stems }] stems = the title stems found among the brief's central words; [] on any store error

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { decisionClauses } from './question-clause-grounding.mjs';
import { optionStems } from './question-grounding.mjs';
import { stemRarity } from './stem-rarity.mjs';
import { storeDocs } from './store-docs.mjs';
import { frameworksFor } from './frameworks.mjs';
import { projectStoreRoot } from './framework-store.mjs';
import { ID_CITE_SRC } from './ids.mjs';
import { BRIEF_CENTRAL_STEMS, BRIEF_DECISIONS_TOP, BRIEF_TITLE_CENTRAL_MIN, GROUNDED_CLAUSE_RARE_MIN_DF, GROUNDED_CLAUSE_RARE_SHARE, GROUNDED_MIN_WORD } from './question-checks.mjs';

const TAG = /\[[^\]]*\]/g;
const CITE = new RegExp(ID_CITE_SRC, 'g');
const WORD = new RegExp(`[a-z][a-z0-9]{${GROUNDED_MIN_WORD - 1},}`, 'g');
const hasDecisions = (root) => existsSync(join(root, '.ai', 'decisions'));

export function decisionStoreRoots(root) {
  const stores = [{ source: 'project', root }];
  for (const framework of frameworksFor(root)) {
    const dirs = [framework.submodule && join(root, framework.submodule), projectStoreRoot(framework.name)].filter(Boolean);
    const found = dirs.find(hasDecisions);
    if (found) stores.push({ source: framework.name, root: found });
  }
  return stores;
}

export const briefText = (text) => String(text ?? '').replace(TAG, ' ');

function centralStems(text, docs, weight) {
  const held = new Set(docs.flatMap((d) => [...d.stems]));
  const counts = new Map();
  for (const word of briefText(text).toLowerCase().match(WORD) || []) {
    for (const stem of optionStems(word)) if (held.has(stem)) counts.set(stem, (counts.get(stem) || 0) + 1);
  }
  return new Set([...counts].map(([stem, n]) => [stem, n * weight(stem)]).sort((a, b) => b[1] - a[1]).slice(0, BRIEF_CENTRAL_STEMS).map(([stem]) => stem));
}

function storeMisses(store, text, named) {
  const docs = storeDocs(store.root).filter((d) => d.kind === 'decision').map((d) => ({ ...d, stems: optionStems(`${d.title} ${decisionClauses(d.text).join(' ')}`), titleStems: optionStems(d.title) }));
  const { weight } = stemRarity(docs.map((d) => d.stems), { share: GROUNDED_CLAUSE_RARE_SHARE, minDf: GROUNDED_CLAUSE_RARE_MIN_DF });
  const central = centralStems(text, docs, weight);
  return docs.filter((d) => !named.has(d.id))
    .map((d) => ({ id: d.id, title: d.title, source: store.source, stems: [...d.titleStems].filter((s) => central.has(s)) }))
    .filter((m) => m.stems.length >= BRIEF_TITLE_CENTRAL_MIN);
}

export function briefDecisionMisses(root, text) {
  try {
    const named = new Set(String(text ?? '').match(CITE) || []);
    return decisionStoreRoots(root).flatMap((store) => storeMisses(store, text, named))
      .sort((a, b) => b.stems.length - a.stems.length || a.id.localeCompare(b.id))
      .slice(0, BRIEF_DECISIONS_TOP);
  } catch {
    return [];
  }
}
