#!/usr/bin/env node
// PreToolUse (AskUserQuestion|request_user_input) — block re-asking the maintainer a question
// another live session already asked and nobody has resolved (KIT-T448). exit 2 = block.
//
// A question file `.ai/questions/<KEY>-Q###.md` carries `(asked) <session>` History lines
// (`t ask`, or stamped here). A questionnaire whose question restates an OPEN question file
// that a DIFFERENT session asked within ASK_WINDOW_DAYS blocks. Override: `[re-ask: <reason>]`
// in any question text. A pass stamps `(asked) <this session>` on every question file the
// questionnaire cites by id. Check id: reask-gate. Fails open on any error.

import { writeFileSync } from 'node:fs';
import { payload, gitRoot, adopted, pathExcluded, excludeFooter } from './lib.mjs';
import { readQuestions } from '../scripts/question-store.mjs';
import { askedEntries, isOpenQuestion, resolutionText, questionMatches, citesId, stampAsk } from '../scripts/question-asks.mjs';

const TOOLS = new Set(['AskUserQuestion', 'request_user_input']);
const CHECK_ID = 'reask-gate';
const ASK_WINDOW_DAYS = 7;
const MS_PER_DAY = 86400000;
const OVERRIDE = /\[re-ask:\s*[^\]]+\]/i;

const textOf = (q) => [q?.header, q?.question, ...(Array.isArray(q?.options) ? q.options.map((o) => `${o?.label || ''} ${o?.description || ''}`) : [])].filter(Boolean).join(' ');
const askText = (q) => [q?.header, q?.question].filter(Boolean).join(' ');

function blockMessage(hits) {
  return [
    'BLOCKED: this questionnaire re-asks the maintainer something another session already asked.',
    ...hits.map((h) => `  ${h.id} (${h.file}) — asked by session ${h.session} on ${h.date}, no Resolution recorded yet.`),
    'Read that session\'s answer (or ask it to write the Resolution: t resolve <id> "<answer>") instead of asking again.',
    'To ask anyway, put `[re-ask: <reason>]` in the question text.',
    excludeFooter(CHECK_ID),
  ].join('\n');
}

try {
  const p = await payload();
  if (p.tool_name && !TOOLS.has(p.tool_name)) process.exit(0);
  const questions = p.tool_input?.questions;
  const root = gitRoot();
  if (!Array.isArray(questions) || !questions.length || !adopted(root)) process.exit(0);
  if (questions.some((q) => OVERRIDE.test(textOf(q)))) process.exit(0);

  const files = readQuestions(root).filter((f) => isOpenQuestion(f.text) && !pathExcluded(root, CHECK_ID, f.file));
  const session = String(p.session_id || '');
  const cutoff = Date.now() - ASK_WINDOW_DAYS * MS_PER_DAY;
  const hits = [];
  for (const f of files) {
    const last = askedEntries(f.text).pop();
    const matched = questions.some((q) => citesId(textOf(q), f.id) || questionMatches(askText(q), f.text));
    if (!matched || !last || last.session === session || resolutionText(f.text)) continue;
    if (Date.parse(last.date) >= cutoff) hits.push({ ...f, ...last });
  }
  if (hits.length) {
    process.stderr.write(blockMessage(hits));
    process.exit(2);
  }

  const cited = (f) => questions.some((q) => citesId(textOf(q), f.id));
  const today = new Date().toISOString().slice(0, 10);
  for (const f of files) {
    const last = askedEntries(f.text).pop();
    if (session && cited(f) && !(last && last.session === session && last.date === today)) writeFileSync(f.file, stampAsk(f.text, session));
  }
} catch {
  /* fail open */
}
process.exit(0);
