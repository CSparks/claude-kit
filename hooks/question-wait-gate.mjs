#!/usr/bin/env node
// PreToolUse (AskUserQuestion|request_user_input) — a recommended option never offers the maintainer a wait over 60 seconds
// to accept without a recorded time budget (KIT-T1480). exit 2 = block. Check id: question-wait.
//
// Each option whose label carries the (Recommended) marker is read (label and description as one unit): a duration over
// WAIT_MAX_SECONDS beside a cue to accept, keep or live with it blocks. The question carrying
// [wait-checked: <the recorded time budget, or why none applies>] passes. The same-reply summary is not on disk before the
// call: the dry run (q gates question --draft, summary field) judges it, and the after-the-call audit
// (question-brief-audit, lib/question-wait-audit.mjs) reports it. Fails open on any error.

import { payload, gitRoot, adopted, pathExcluded, excludeFooter } from './lib.mjs';
import { optionWaitOffers, hasWaitChecked } from './lib/wait-offer.mjs';
import { RECOMMENDED_MARKER, WAIT_CHECK as CHECK_ID, WAIT_MAX_SECONDS } from './lib/question-checks.mjs';
import { TOKENS } from './lib/gate-tokens.mjs';

const TOOLS = new Set(['AskUserQuestion', 'request_user_input']);
const MAX_QUOTED = 200;
const MARKER = RECOMMENDED_MARKER.toLowerCase();

const label = (o) => String(o?.label || '').trim().toLowerCase();
const recommended = (o, tool) => (tool === 'request_user_input' ? label(o).endsWith(MARKER) : label(o).startsWith(MARKER));
const questionText = (q) => [q?.header, q?.question, ...(Array.isArray(q?.options) ? q.options.flatMap((o) => [o?.label, o?.description]) : [])].filter(Boolean).join(' ');

function offersOf(q, tool) {
  if (hasWaitChecked(questionText(q))) return [];
  const options = Array.isArray(q?.options) ? q.options : [];
  return options.filter((o) => recommended(o, tool)).flatMap((o) => optionWaitOffers(o).map((offer) => ({ where: `the recommended option "${String(o.label).trim()}"`, ...offer })));
}

function blockMessage(offers) {
  return [
    `BLOCKED: this questionnaire recommends accepting a wait over ${WAIT_MAX_SECONDS} seconds (KIT-T1480); no recorded ruling says the maintainer accepts it.`,
    ...offers.map((o) => `  ${o.where}: "${o.phrase}" (${o.seconds} s) — "${o.unit.slice(0, MAX_QUOTED)}"`),
    '',
    'A user-visible wait of minutes (load, build, launch) is the maintainer\'s to accept, never a default recommendation.',
    'Fix: recommend the option that removes or shortens the wait, or put the wait to him as a plain choice with his recorded time budget (q fts <terms>);',
    `when a recorded ruling bounds it, or none applies, add ${TOKENS.waitChecked.form} to the question text saying which.`,
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
  const offers = questions.flatMap((q) => offersOf(q, p.tool_name));
  if (offers.length) {
    process.stderr.write(blockMessage(offers));
    process.exit(2);
  }
} catch {
  /* fail open */
}
process.exit(0);
