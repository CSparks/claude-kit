#!/usr/bin/env node
// PreToolUse (AskUserQuestion|request_user_input) — an option the project already decided or ticketed is cited, not
// offered fresh (KIT-T936). exit 2 = block. Check id: question-grounded.
//
// Each option label is matched against the store's decisions and open tickets (lib/question-grounding.mjs), and the
// question text (header, question, option descriptions) against the Decision clauses of the decisions
// (lib/question-clause-grounding.mjs, KIT-T1215). A match whose id the questionnaire text (header, question, option
// labels and descriptions) or the readable turn prose never names blocks. The summary written in the same reply as the
// call is not on disk yet, so cite in the questionnaire.
// Escapes in the questionnaire text: `[options-checked: none apply: <why>]` passes it; `[options-checked: <ids> govern this; no
// other recorded decision applies]` with at least one id the store holds in force clears the label matches and raises the clause
// bar to TAGGED_BAR, a near-verbatim restatement (KIT-T1431, KIT-T1451). The tag text itself is never matched. A question is judged
// sentence by sentence (a long summary pooled would share loose words with most decisions). Fails open on any error.

import { payload, gitRoot, adopted, pathExcluded, excludeFooter } from './lib.mjs';
import { groundingMisses } from './lib/question-grounding.mjs';
import { CLAUSE_BAR, TAGGED_BAR, clauseMisses } from './lib/question-clause-grounding.mjs';
import { storeDocs } from './lib/store-docs.mjs';
import { turnText } from './lib/turn-text.mjs';
import { GROUNDED_CHECK, GROUNDED_CLAUSE_SHOWN } from './lib/question-checks.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';
import { assertedGoverning, stripOptionsChecked } from './lib/options-checked.mjs';

const TOOLS = new Set(['AskUserQuestion', 'request_user_input']);
const MAX_TITLE_SHOWN = 90;
const MAX_SHOWN = 6;

// The questionnaire as the matchers read it: the author's [options-checked: ...] tags are claims, never text to match.
const withoutTags = (q) => ({
  ...q,
  header: stripOptionsChecked(q?.header),
  question: stripOptionsChecked(q?.question),
  options: Array.isArray(q?.options) ? q.options.map((o) => ({ ...o, label: stripOptionsChecked(o?.label), description: stripOptionsChecked(o?.description) })) : q?.options,
});

const optionText = (o) => `${o?.label || ''} ${o?.description || ''}`;
const questionText = (q) => [q?.header, q?.question, ...(Array.isArray(q?.options) ? q.options.map(optionText) : [])].filter(Boolean).join(' ');

function blockMessage(misses, restated) {
  const first = misses[0] || restated[0];
  return [
    'BLOCKED: the questionnaire matches a recorded decision or open ticket it does not cite (KIT-T936, KIT-T1215).',
    ...misses.slice(0, MAX_SHOWN).map((m) => `  ${m.id} (${m.kind}) "${m.title.slice(0, MAX_TITLE_SHOWN)}" — matched by the option "${m.option}" (shared words: ${m.words.join(', ')})`),
    ...restated.slice(0, MAX_SHOWN).map((m) => `  ${m.id} (decision) "${m.title.slice(0, MAX_TITLE_SHOWN)}" — the question text restates its clause: "${m.clause.slice(0, GROUNDED_CLAUSE_SHOWN)}" (matched words: ${m.stems.join(', ')}; matched rare words: ${m.rare.join(', ')}; score ${m.score})`),
    '',
    'The maintainer already ruled on, or filed, work like this; offering it fresh makes him re-decide a settled point.',
    'Read each item (q show <id>), then in the question text or an option description say what it is in plain words and cite it:',
    `  "${first.title.slice(0, MAX_TITLE_SHOWN)} (${first.id})" — and let the options build on it, never restate it as new.`,
    `When none governs the options, add ${TOKENS.optionsChecked.form} to the question text.`,
    `When some govern them and the rest matched on loose words, add ${TOKENS.optionsCheckedIds.form} with the governing ids (a decision in force, as q show reads it): only a near-verbatim restatement of an uncited decision then blocks.`,
    '',
    excludeFooter(GROUNDED_CHECK),
  ].join('\n');
}

try {
  const p = await payload();
  if (p.tool_name && !TOOLS.has(p.tool_name)) process.exit(0);
  const questions = p.tool_input?.questions;
  const root = gitRoot();
  if (!Array.isArray(questions) || !questions.length || !adopted(root) || pathExcluded(root, GROUNDED_CHECK, root)) process.exit(0);
  const turn = p.transcript_path ? turnText(p.transcript_path) : null;
  const cited = [...questions.map(questionText), turn?.prose || ''].join('\n');
  if (TOKENS.optionsChecked.pattern.test(cited)) process.exit(0);
  const docs = storeDocs(root);
  const governing = assertedGoverning(cited, new Set(docs.map((d) => d.id)));
  const judged = questions.map(withoutTags);
  const misses = governing.length ? [] : groundingMisses(docs, judged, cited);
  const restated = clauseMisses(docs, judged, cited, governing.length ? TAGGED_BAR : CLAUSE_BAR);
  if (misses.length || restated.length) {
    process.stderr.write(blockMessage(misses, restated));
    process.exit(2);
  }
} catch {
  /* fail open */
}
process.exit(0);
