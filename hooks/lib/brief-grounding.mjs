// brief-grounding — which recorded decisions does a dispatch brief overlap without naming (KIT-T1458)?
// A plan, analysis or perf brief describes work by topic; it seldom restates a ruling's clause, so the questionnaire's clause
// matcher misses it (RDG-D031, "every deterministic output is cached", went unread by a persistence plan that named a
// neighbouring decision). Here each decision is one document (its title and Decision paragraph, cut to word stems) and the
// brief (bracketed tags removed) is matched against all of them in the project's store and in the store of every framework the
// project uses. A decision's coverage is the share of its stem weight the brief shares, each stem weighted by rarity over the
// store's decisions. The BRIEF_DECISIONS_TOP best-covered decisions the brief does not name, each over the floor, are the misses:
// a long brief overlaps many decisions, so the demand is bounded and ranked, never every decision that shares a word.
// A decision is cleared only by naming its id anywhere in the brief (a [rulings-checked: ...] tag included).
//
//   decisionStoreRoots(root)        -> [{ source: 'project' | <framework name>, root }] the stores whose decisions bind the brief
//   briefText(text)                 -> the brief without its bracketed tags
//   briefDecisionMisses(root, text) -> [{ id, title, source, coverage, stems }] highest coverage first; [] on any store error

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { decisionClauses } from './question-clause-grounding.mjs';
import { optionStems } from './question-grounding.mjs';
import { stemRarity } from './stem-rarity.mjs';
import { storeDocs } from './store-docs.mjs';
import { frameworksFor } from './frameworks.mjs';
import { projectStoreRoot } from './framework-store.mjs';
import { ID_CITE_SRC } from './ids.mjs';
import { BRIEF_COVERAGE_MIN, BRIEF_DECISIONS_TOP, BRIEF_MIN_SHARED, BRIEF_STEMS_SHOWN, GROUNDED_CLAUSE_RARE_MIN_DF, GROUNDED_CLAUSE_RARE_SHARE } from './question-checks.mjs';

const TAG = /\[[^\]]*\]/g;
const CITE = new RegExp(ID_CITE_SRC, 'g');
const COVERAGE_DIGITS = 2;
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

function storeMisses(store, wanted, named) {
  const docs = storeDocs(store.root).filter((d) => d.kind === 'decision').map((d) => ({ ...d, stems: optionStems(`${d.title} ${decisionClauses(d.text).join(' ')}`) }));
  const { weight } = stemRarity(docs.map((d) => d.stems), { share: GROUNDED_CLAUSE_RARE_SHARE, minDf: GROUNDED_CLAUSE_RARE_MIN_DF });
  const sum = (stems) => stems.reduce((total, s) => total + weight(s), 0);
  return docs.map((d) => {
    const shared = [...d.stems].filter((s) => wanted.has(s));
    return { id: d.id, title: d.title, source: store.source, coverage: Number((sum(shared) / sum([...d.stems])).toFixed(COVERAGE_DIGITS)), stems: shared };
  }).filter((m) => !named.has(m.id) && m.stems.length >= BRIEF_MIN_SHARED && m.coverage >= BRIEF_COVERAGE_MIN);
}

export function briefDecisionMisses(root, text) {
  try {
    const named = new Set(String(text ?? '').match(CITE) || []);
    const wanted = optionStems(briefText(text));
    return decisionStoreRoots(root).flatMap((store) => storeMisses(store, wanted, named))
      .sort((a, b) => b.coverage - a.coverage || a.id.localeCompare(b.id))
      .slice(0, BRIEF_DECISIONS_TOP)
      .map((m) => ({ ...m, stems: m.stems.slice(0, BRIEF_STEMS_SHOWN) }));
  } catch {
    return [];
  }
}
