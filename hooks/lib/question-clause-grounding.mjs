// question-clause-grounding — does the TEXT of a questionnaire restate a clause a decision already ruled (KIT-T1215)?
// The label matcher (question-grounding.mjs) judges option labels against titles; a question body or option description
// that restates a ruled clause passed it. Here each text unit (the question, one option description) is cut to the same
// word stems and compared with each Decision clause of the store's decisions. Each stem is weighted by rarity over every clause
// of the store (ln(1 + clauses / clauses holding the stem) / ln(1 + clauses): 1 for a stem in one clause, near 0 for one in all,
// so the score reads the same in a small and a large store); a clause is a restatement when it shares GROUNDED_CLAUSE_SHARED
// stems with one unit, at least one of them rare (in no more than GROUNDED_CLAUSE_RARE_SHARE of the clauses), and the weights
// sum to GROUNDED_CLAUSE_SCORE: common stems (project, kit, group, scene, song) alone never restate a ruling. Units are judged
// one by one (each sentence of the question, each option description): pooled, a long questionnaire shares stems with most
// clauses (KIT-T1451). A restatement also shares a run of GROUNDED_CLAUSE_PHRASE consecutive words with the clause (shared-run.mjs),
// and the score bar grows with a unit longer than GROUNDED_CLAUSE_LONG_STEMS stems.
// Generic engineering stems (generic-stems.mjs: check, run, work, time, usage) are never in a stem set (KIT-T1431), and a
// restatement holds GROUNDED_CLAUSE_MIN_RARE distinct rare stems.
// The decision id must be cited in the questionnaire text (an `[options-checked: ...]` tag included) or the readable turn
// prose; a tag clears only the decisions it names (KIT-T1457).
//
//   decisionClauses(text)                    -> [string] the numbered clauses (1)..(n) of the `**Decision:**` paragraph, or its sentences
//   indexClauses(docs)                       -> the decision clauses with their stems, the stem weight and the rarity test
//   clauseMatches(docs, text, index?, bar?)  -> [{ id, kind, title, clause, shared, stems, rare, score }] best clause per decision, highest score first; bar = CLAUSE_BAR
//   clauseMisses(docs, questions, cited, bar?) -> clauseMatches of each text unit whose decision id `cited` never names
//   questionRestatementTexts(question)       -> the question and each option description (labels stay with the label matcher)

import {
  GROUNDED_CLAUSE_MIN_RARE, GROUNDED_CLAUSE_PER_QUESTION, GROUNDED_CLAUSE_RARE_MIN_DF, GROUNDED_CLAUSE_RARE_SHARE, GROUNDED_CLAUSE_SCORE,
  GROUNDED_CLAUSE_PHRASE, GROUNDED_CLAUSE_SHARED, GROUNDED_CLAUSE_LONG_STEMS,
} from './question-checks.mjs';
import { optionStems } from './question-grounding.mjs';
import { stemRarity } from './stem-rarity.mjs';
import { longestSharedRun } from './shared-run.mjs';
import { ID_CITE_SRC } from './ids.mjs';

const DECISION_PARAGRAPH = /\*\*Decision:\*\*([\s\S]*?)(?=\n\s*\*\*[A-Za-z][\w -]*:\*\*|$)/i;
const NUMBERED_MARKER = /\(\d+\)/;
const SENTENCE_BREAK = /(?<=[.;])\s+/;
const CITE = new RegExp(ID_CITE_SRC, 'g');

export function decisionClauses(text) {
  const body = DECISION_PARAGRAPH.exec(String(text))?.[1];
  if (!body) return [];
  const parts = NUMBERED_MARKER.test(body) ? body.split(/\(\d+\)/) : body.split(SENTENCE_BREAK);
  return parts.map((p) => p.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

const QUESTION_SENTENCE_BREAK = /(?<=[.;?!])\s+/;
const sentences = (text) => String(text ?? '').split(QUESTION_SENTENCE_BREAK).map((s) => s.trim()).filter(Boolean);

// A long question is a summary of many sentences; pooled it shares loose words with most clauses, so each sentence is a unit.
export const questionRestatementTexts = (q) => [...sentences(q?.question), ...(Array.isArray(q?.options) ? q.options.map((o) => o?.description) : [])].filter(Boolean);

const SCORE_DIGITS = 2;

export function indexClauses(docs) {
  const clauses = [];
  for (const d of docs.filter((x) => x.kind === 'decision')) {
    for (const clause of decisionClauses(d.text)) clauses.push({ id: d.id, kind: d.kind, title: d.title, clause, stems: optionStems(clause) });
  }
  const { weight, isRare } = stemRarity(clauses.map((c) => c.stems), { share: GROUNDED_CLAUSE_RARE_SHARE, minDf: GROUNDED_CLAUSE_RARE_MIN_DF });
  return { clauses, weight, isRare };
}

function scoreClause(index, wanted, c, text) {
  const stems = [...wanted].filter((s) => c.stems.has(s));
  const score = stems.reduce((sum, s) => sum + index.weight(s), 0);
  return { ...c, stems, rare: stems.filter(index.isRare), score: Number(score.toFixed(SCORE_DIGITS)), size: wanted.size, text };
}

export const CLAUSE_BAR = { minRare: GROUNDED_CLAUSE_MIN_RARE, score: GROUNDED_CLAUSE_SCORE, phrase: GROUNDED_CLAUSE_PHRASE };

// A unit of many stems shares more by chance: past GROUNDED_CLAUSE_LONG_STEMS the score bar grows with its length.
const lengthFactor = (size) => Math.max(1, size / GROUNDED_CLAUSE_LONG_STEMS);

const restates = (m, bar) => m.stems.length >= GROUNDED_CLAUSE_SHARED && m.rare.length >= bar.minRare && m.score >= bar.score * lengthFactor(m.size)
  && (!bar.phrase || longestSharedRun(m.text, m.clause) >= bar.phrase);

export function clauseMatches(docs, text, index = indexClauses(docs), bar = CLAUSE_BAR) {
  const wanted = optionStems(text);
  if (wanted.size < GROUNDED_CLAUSE_SHARED) return [];
  const best = new Map();
  for (const c of index.clauses) {
    const m = scoreClause(index, wanted, c, text);
    if (restates(m, bar) && m.score > (best.get(m.id)?.score ?? 0)) best.set(m.id, m);
  }
  return [...best.values()]
    .map(({ id, kind, title, clause, stems, rare, score }) => ({ id, kind, title, clause, shared: stems.length, stems, rare, score }))
    .sort((a, b) => b.score - a.score || b.id.localeCompare(a.id))
    .slice(0, GROUNDED_CLAUSE_PER_QUESTION);
}

export function clauseMisses(docs, questions, cited, bar = CLAUSE_BAR) {
  const named = new Set(String(cited).match(CITE) || []);
  const misses = new Map();
  const index = indexClauses(docs);
  for (const q of Array.isArray(questions) ? questions : []) {
    for (const text of questionRestatementTexts(q)) {
      for (const m of clauseMatches(docs, text, index, bar)) {
        if (!named.has(m.id) && !misses.has(m.id)) misses.set(m.id, m);
      }
    }
  }
  return [...misses.values()];
}
