#!/usr/bin/env node
// PreToolUse (AskUserQuestion|request_user_input) — a questionnaire that restates a standing decision is stopped
// with the decision's own text; one that only shares words with decisions is let through with those decisions
// listed as context (KIT-T744, KIT-T907, KIT-D151). exit 2 = block, 0 = allow.
//
// restated  every distinctive word of a decision's title is in ONE sentence of the question, or in its header (decision-governs.mjs);
//           a question whose [options-checked: <ids> govern this ...] tag names ids in force is judged near-verbatim only (a run of
//           the title's own words). A decision that GOVERNS the options is context, not a restatement: one the questionnaire names
//           by id is never blocked (KIT-T744, KIT-T1451).
//           The block repeats until the question is rewritten or the decision is excluded: no unchanged resend passes.
// related   decisions that share words with the questionnaire, options included: advisory context, never a block.
// Check id: decision-gate. Fails open on any error.

import { payload, gitRoot, adopted, pathExcluded, excludeFooter } from './lib.mjs';
import { governingDecisions, readDecisions, restatedDecisions } from '../scripts/decision-governs.mjs';
import { assertedGoverning, stripOptionsChecked } from './lib/options-checked.mjs';
import { storeDocs } from './lib/store-docs.mjs';
import { ID_CITE_SRC } from './lib/ids.mjs';

const TOOLS = new Set(['AskUserQuestion', 'request_user_input']);
const CHECK_ID = 'decision-gate';

const optionText = (q) => (Array.isArray(q?.options) ? q.options.map((o) => `${o?.label || ''} ${o?.description || ''}`) : []);
const askedText = (q) => [q?.header, q?.question].filter(Boolean).join(' ');
const allText = (q) => [q?.header, q?.question, ...optionText(q)].filter(Boolean).join(' ');
const ID_CITE = new RegExp(ID_CITE_SRC, 'g');
// A long question is a summary: judged sentence by sentence, with the author's [options-checked: ...] tag cut (KIT-T1451).
const askedUnits = (q) => [stripOptionsChecked(q?.header), ...stripOptionsChecked(q?.question).split(/(?<=[.;?!])\s+/)].map((u) => u.trim()).filter(Boolean);
const listing = (decisions) => decisions.map((d) => `  ${d.id} — ${d.title}${d.hit ? `\n    ${d.hit}` : ''}`);

function blockMessage(restated) {
  return [
    'BLOCKED: this questionnaire restates a standing decision (KIT-T744).',
    ...listing(restated),
    'Act on the decision and do not ask. If the question differs from it, rewrite the question so it asks what the decision does not state.',
    'If it only cites the decision as context for the options, name it by id in the question text (a cited decision is context, never a restatement).',
    excludeFooter(CHECK_ID),
  ].join('\n');
}

const advisory = (related) => ({
  hookSpecificOutput: {
    hookEventName: 'PreToolUse',
    additionalContext: ['Standing decisions that share words with this questionnaire (context, not a block; if one already answers it, tell the maintainer):', ...listing(related)].join('\n'),
  },
});

try {
  const p = await payload();
  if (p.tool_name && !TOOLS.has(p.tool_name)) process.exit(0);
  const questions = p.tool_input?.questions;
  const root = gitRoot();
  if (!Array.isArray(questions) || !questions.length || !adopted(root)) process.exit(0);

  const decisions = readDecisions(root).filter((d) => !pathExcluded(root, CHECK_ID, d.file));
  const live = new Set(storeDocs(root).map((d) => d.id));
  const tagged = assertedGoverning(questions.map(askedText).join(' '), live).length > 0;
  const named = new Set(questions.map(allText).join(' ').match(ID_CITE) || []);
  const restated = restatedDecisions(questions.flatMap(askedUnits), decisions, { tagged }).filter((d) => !named.has(d.id));
  if (restated.length) {
    process.stderr.write(blockMessage(restated));
    process.exit(2);
  }
  const related = governingDecisions(questions.flatMap((q) => [askedText(q), ...optionText(q)]).join(' '), decisions);
  if (related.length) process.stdout.write(JSON.stringify(advisory(related)));
} catch {
  /* fail open */
}
process.exit(0);
