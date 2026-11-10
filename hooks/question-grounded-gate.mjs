#!/usr/bin/env node
// PreToolUse (AskUserQuestion|request_user_input) — an option the project already decided or ticketed is cited, not
// offered fresh (KIT-T936). exit 2 = block. Check id: question-grounded.
//
// Each option label is matched against the store's decisions and open tickets (lib/question-grounding.mjs). A match
// whose id the questionnaire text (header, question, option labels and descriptions) or the readable turn prose never
// names blocks. The summary written in the same reply as the call is not on disk yet, so cite in the questionnaire.
// Escape: `[options-checked: none apply: <why>]` in the questionnaire text. Fails open on any error.

import { payload, gitRoot, adopted, pathExcluded, excludeFooter } from './lib.mjs';
import { groundingMisses } from './lib/question-grounding.mjs';
import { storeDocs } from './lib/store-docs.mjs';
import { turnText } from './lib/turn-text.mjs';
import { GROUNDED_CHECK } from './lib/question-checks.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';

const TOOLS = new Set(['AskUserQuestion', 'request_user_input']);
const MAX_TITLE_SHOWN = 90;
const MAX_SHOWN = 6;

const optionText = (o) => `${o?.label || ''} ${o?.description || ''}`;
const questionText = (q) => [q?.header, q?.question, ...(Array.isArray(q?.options) ? q.options.map(optionText) : [])].filter(Boolean).join(' ');

function blockMessage(misses) {
  const first = misses[0];
  return [
    'BLOCKED: an option matches a recorded decision or open ticket the questionnaire does not cite (KIT-T936).',
    ...misses.slice(0, MAX_SHOWN).map((m) => `  ${m.id} (${m.kind}) "${m.title.slice(0, MAX_TITLE_SHOWN)}" — matched by the option "${m.option}"`),
    '',
    'The maintainer already ruled on, or filed, work like this; offering it fresh makes him re-decide a settled point.',
    'Read each item (q show <id>), then in the question text or an option description say what it is in plain words and cite it:',
    `  "${first.title.slice(0, MAX_TITLE_SHOWN)} (${first.id})" — and let the options build on it, never restate it as new.`,
    `When none governs the options, add ${TOKENS.optionsChecked.form} to the question text.`,
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
  const misses = groundingMisses(storeDocs(root), questions, cited);
  if (misses.length) {
    process.stderr.write(blockMessage(misses));
    process.exit(2);
  }
} catch {
  /* fail open */
}
process.exit(0);
