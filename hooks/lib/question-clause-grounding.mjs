// question-clause-grounding — does the TEXT of a questionnaire restate a clause a decision already ruled (KIT-T1215)?
// The label matcher (question-grounding.mjs) judges option labels against titles; a question body or option description
// that restates a ruled clause passed it. Here each text unit (the question, one option description) is cut to the same
// word stems and compared with each Decision clause of the store's decisions: a clause sharing GROUNDED_CLAUSE_SHARED stems
// with one unit is a restatement. Units are judged one by one: pooled, a long questionnaire shares 3 stems with most clauses.
// The decision id must be cited in the questionnaire text or the readable turn prose.
//
//   decisionClauses(text)                    -> [string] the numbered clauses (1)..(n) of the `**Decision:**` paragraph, or its sentences
//   clauseMatches(docs, text)                -> [{ id, kind, title, clause, shared }] best clause per decision, most shared first
//   clauseMisses(docs, questions, cited)     -> clauseMatches of each text unit whose decision id `cited` never names
//   questionRestatementTexts(question)       -> the question and each option description (labels stay with the label matcher)

import { GROUNDED_CLAUSE_PER_QUESTION, GROUNDED_CLAUSE_SHARED } from './question-checks.mjs';
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

const sharedCount = (a, b) => [...a].filter((s) => b.has(s)).length;

export function clauseMatches(docs, text) {
  const wanted = optionStems(text);
  if (wanted.size < GROUNDED_CLAUSE_SHARED) return [];
  const found = [];
  for (const d of docs.filter((x) => x.kind === 'decision')) {
    const best = decisionClauses(d.text)
      .map((clause) => ({ clause, shared: sharedCount(wanted, optionStems(clause)) }))
      .reduce((top, c) => (c.shared > (top?.shared ?? 0) ? c : top), null);
    if (best && best.shared >= GROUNDED_CLAUSE_SHARED) found.push({ id: d.id, kind: d.kind, title: d.title, clause: best.clause, shared: best.shared });
  }
  return found.sort((a, b) => b.shared - a.shared || b.id.localeCompare(a.id)).slice(0, GROUNDED_CLAUSE_PER_QUESTION);
}

export function clauseMisses(docs, questions, cited) {
  const named = new Set(String(cited).match(CITE) || []);
  const misses = new Map();
  for (const q of Array.isArray(questions) ? questions : []) {
    for (const text of questionRestatementTexts(q)) {
      for (const m of clauseMatches(docs, text)) {
        if (!named.has(m.id) && !misses.has(m.id)) misses.set(m.id, m);
      }
    }
  }
  return [...misses.values()];
}
