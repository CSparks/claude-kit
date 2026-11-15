// question-clause-grounding — does the TEXT of a questionnaire restate a clause a decision already ruled (KIT-T1215)?
// The label matcher (question-grounding.mjs) judges option labels against titles; a question body or option description
// that restates a ruled clause passed it. Here each text unit (the question, one option description) is cut to the same
// word stems and compared with each Decision clause of the store's decisions. Each stem is weighted by rarity over every clause
// of the store (ln(1 + clauses / clauses holding the stem) / ln(1 + clauses): 1 for a stem in one clause, near 0 for one in all,
// so the score reads the same in a small and a large store); a clause is a restatement when it shares GROUNDED_CLAUSE_SHARED
// stems with one unit, at least one of them rare (in no more than GROUNDED_CLAUSE_RARE_SHARE of the clauses), and the weights
// sum to GROUNDED_CLAUSE_SCORE: common stems (project, kit, group, scene, song) alone never restate a ruling. Units are judged
// one by one: pooled, a long questionnaire shares stems with most clauses.
// The decision id must be cited in the questionnaire text or the readable turn prose.
//
//   decisionClauses(text)                    -> [string] the numbered clauses (1)..(n) of the `**Decision:**` paragraph, or its sentences
//   indexClauses(docs)                       -> the decision clauses with their stems, the stem weight and the rarity test
//   clauseMatches(docs, text, index?)        -> [{ id, kind, title, clause, shared, stems, rare, score }] best clause per decision, highest score first
//   clauseMisses(docs, questions, cited)     -> clauseMatches of each text unit whose decision id `cited` never names
//   questionRestatementTexts(question)       -> the question and each option description (labels stay with the label matcher)

import { GROUNDED_CLAUSE_PER_QUESTION, GROUNDED_CLAUSE_RARE_MIN_DF, GROUNDED_CLAUSE_RARE_SHARE, GROUNDED_CLAUSE_SCORE, GROUNDED_CLAUSE_SHARED } from './question-checks.mjs';
import { optionStems } from './question-grounding.mjs';
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

export const questionRestatementTexts = (q) => [q?.question, ...(Array.isArray(q?.options) ? q.options.map((o) => o?.description) : [])].filter(Boolean);

const SCORE_DIGITS = 2;

export function indexClauses(docs) {
  const clauses = [];
  for (const d of docs.filter((x) => x.kind === 'decision')) {
    for (const clause of decisionClauses(d.text)) clauses.push({ id: d.id, kind: d.kind, title: d.title, clause, stems: optionStems(clause) });
  }
  const df = new Map();
  for (const c of clauses) for (const s of c.stems) df.set(s, (df.get(s) || 0) + 1);
  const rareMaxDf = Math.max(GROUNDED_CLAUSE_RARE_MIN_DF, Math.floor(clauses.length * GROUNDED_CLAUSE_RARE_SHARE));
  const top = Math.log(1 + clauses.length);
  const weight = (s) => Math.log(1 + clauses.length / df.get(s)) / top;
  return { clauses, weight, isRare: (s) => df.get(s) <= rareMaxDf };
}

function scoreClause(index, wanted, c) {
  const stems = [...wanted].filter((s) => c.stems.has(s));
  const score = stems.reduce((sum, s) => sum + index.weight(s), 0);
  return { ...c, stems, rare: stems.filter(index.isRare), score: Number(score.toFixed(SCORE_DIGITS)) };
}

const restates = (m) => m.stems.length >= GROUNDED_CLAUSE_SHARED && m.rare.length > 0 && m.score >= GROUNDED_CLAUSE_SCORE;

export function clauseMatches(docs, text, index = indexClauses(docs)) {
  const wanted = optionStems(text);
  if (wanted.size < GROUNDED_CLAUSE_SHARED) return [];
  const best = new Map();
  for (const c of index.clauses) {
    const m = scoreClause(index, wanted, c);
    if (restates(m) && m.score > (best.get(m.id)?.score ?? 0)) best.set(m.id, m);
  }
  return [...best.values()]
    .map(({ id, kind, title, clause, stems, rare, score }) => ({ id, kind, title, clause, shared: stems.length, stems, rare, score }))
    .sort((a, b) => b.score - a.score || b.id.localeCompare(a.id))
    .slice(0, GROUNDED_CLAUSE_PER_QUESTION);
}

export function clauseMisses(docs, questions, cited) {
  const named = new Set(String(cited).match(CITE) || []);
  const misses = new Map();
  const index = indexClauses(docs);
  for (const q of Array.isArray(questions) ? questions : []) {
    for (const text of questionRestatementTexts(q)) {
      for (const m of clauseMatches(docs, text, index)) {
        if (!named.has(m.id) && !misses.has(m.id)) misses.set(m.id, m);
      }
    }
  }
  return [...misses.values()];
}
