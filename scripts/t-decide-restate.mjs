// Restatement check for `t decide` (KIT-T1315): each clause of the draft's `**Decision:**` paragraph goes through the
// question gate's clause matcher (hooks/lib/question-clause-grounding.mjs, same thresholds) against the store's open
// decisions. A decision it restates refuses the draft unless the draft names that id anywhere in its text (a
// `**Relates:**` / `**Amends:**` line, `supersedes:`, the body), the id arrives through `--supersedes` or `--not-dup`,
// or the draft carries `[restates-ok: <why>]`. `[amends: <id>]` is a cite like any other.
//
//   restatedDecisions(root, draftText, addressed?) -> [{ id, title, yours, clause, score, rare }]   best first, empty when none stands
//   restateRefusal(matches) -> string   the message `t decide` throws: ids, both clauses, the three ways out

import { clauseMatches, decisionClauses } from '../hooks/lib/question-clause-grounding.mjs';
import { GROUNDED_CLAUSE_SCORE, GROUNDED_CLAUSE_SHOWN } from '../hooks/lib/question-checks.mjs';
import { ID_CITE_SRC } from '../hooks/lib/ids.mjs';
import { storeDocs } from '../hooks/lib/store-docs.mjs';

const CITE = new RegExp(ID_CITE_SRC, 'g');
const RESTATES_OK = /\[restates-ok:\s*[^\]\s][^\]]*\]/i;
const MAX_TITLE_SHOWN = 90;

export function restatedDecisions(root, draftText, addressed = []) {
  if (RESTATES_OK.test(draftText)) return [];
  const named = new Set([...(String(draftText).match(CITE) || []), ...addressed]);
  const docs = storeDocs(root);
  const best = new Map();
  for (const yours of decisionClauses(draftText)) {
    for (const m of clauseMatches(docs, yours)) {
      if (!named.has(m.id) && m.score > (best.get(m.id)?.score ?? 0)) best.set(m.id, { id: m.id, title: m.title, yours, clause: m.clause, score: m.score, rare: m.rare });
    }
  }
  return [...best.values()].sort((a, b) => b.score - a.score || b.id.localeCompare(a.id));
}

export function restateRefusal(matches) {
  const shown = matches.map((m) => [
    `  ${m.id} "${m.title.slice(0, MAX_TITLE_SHOWN)}"`,
    `    ruled:  "${m.clause.slice(0, GROUNDED_CLAUSE_SHOWN)}"`,
    `    yours:  "${m.yours.slice(0, GROUNDED_CLAUSE_SHOWN)}"`,
    `    score ${m.score} (blocks at ${GROUNDED_CLAUSE_SCORE}), rare stems: ${m.rare.join(', ')}`,
  ].join('\n'));
  return [
    `t decide: refusing, the Decision restates ${matches.length === 1 ? 'an existing decision' : 'existing decisions'}:`,
    ...shown,
    'Read it (q show <id>), then: cite the id in the draft (**Relates:** / **Amends:** line or the body), add [amends: <id>] to change it,',
    'run t revise <id> to sharpen it, or add [restates-ok: <why>] when the restatement is deliberate.',
  ].join('\n');
}
