#!/usr/bin/env node
// PreToolUse (AskUserQuestion|request_user_input) — an option that bundles several decisions under one label ("Accept all
// four", "All of the above") lists its parts (RDG-D176, KIT-T1515). exit 2 = block. Check id: question-bundle.
//
// The parts are read from the questionnaire alone: the option description lists them (separated by semicolons or commas), or
// "all of the above" stands for the other options. A bundle whose parts cannot be told apart, or number fewer than the label
// says, blocks. A question carrying [bundle-checked: <why>] passes. Whether the summary above the call names each part is
// judged by the dry run (q gates question --draft) and the after-the-call audit: the same-reply summary is unreadable here.
// Fails open on any error.

import { payload, gitRoot, adopted, pathExcluded, excludeFooter } from './lib.mjs';
import { bundledOptions, bundleShortfalls, hasBundleChecked } from './lib/question-bundle.mjs';
import { BUNDLE_CHECK as CHECK_ID } from './lib/question-checks.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';

const TOOLS = new Set(['AskUserQuestion', 'request_user_input']);

const rawText = (q) => [q?.header, q?.question, ...(Array.isArray(q?.options) ? q.options.flatMap((o) => [o?.label, o?.description]) : [])].filter(Boolean).join(' ');

function blockMessage(shortfalls) {
  return [
    'BLOCKED: an option bundles several decisions under one label and the questionnaire does not list them (RDG-D176, KIT-T1515).',
    ...shortfalls.map((b) => `  "${b.label}" (${b.header}): ${b.count ? `the label says ${b.count}, ` : ''}the ${b.ofSiblings ? 'other options' : 'option description'} give ${b.found} part${b.found === 1 ? '' : 's'}`),
    '',
    'The maintainer cannot answer "accept all four" without knowing the four. Fix: split the bundle into one question per decision, or list every part in the option description',
    '(one part per semicolon, as many as the label says) and name each part, with what it does and costs, in the summary above the call.',
    `When the label is one decision on purpose, add ${TOKENS.bundleChecked.form} to the question text.`,
    '',
    excludeFooter(CHECK_ID),
  ].join('\n');
}

try {
  const p = await payload();
  if (p.tool_name && !TOOLS.has(p.tool_name)) process.exit(0);
  const questions = p.tool_input?.questions;
  const root = gitRoot();
  if (!Array.isArray(questions) || !questions.length || !adopted(root) || pathExcluded(root, CHECK_ID, root)) process.exit(0);
  const open = questions.filter((q) => !hasBundleChecked(rawText(q)));
  const shortfalls = bundleShortfalls(bundledOptions(open));
  if (shortfalls.length) {
    process.stderr.write(blockMessage(shortfalls));
    process.exit(2);
  }
} catch {
  /* fail open */
}
process.exit(0);
