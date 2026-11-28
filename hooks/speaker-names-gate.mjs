#!/usr/bin/env node
// PreToolUse (AskUserQuestion|request_user_input) — in a project whose store holds the speaker-names decision (RDG-D177),
// a questionnaire names the parties "Chris" and "Claude": the question text, option labels and option descriptions never
// use you, your, yours, I, my, me, we, our or us for them (KIT-T1624). exit 2 = block. Check id: speaker-names.
//
// The summary above the call and ordinary replies are not judged. Quoted words, code and gate tags are exempt
// (lib/speaker-names.mjs). Fails open on any error.

import { payload, gitRoot, adopted, pathExcluded, excludeFooter } from './lib.mjs';
import { SPEAKER_RULE_ID, speakerHits, speakerRuleHeld } from './lib/speaker-names.mjs';
import { SPEAKER_CHECK as CHECK_ID } from './lib/question-checks.mjs';

const TOOLS = new Set(['AskUserQuestion', 'request_user_input']);
const HITS_SHOWN = 8;
const SENTENCE_SHOWN_CHARS = 200;

function fieldsOf(q, n) {
  const where = `question ${n + 1}${q?.header ? ` (${q.header})` : ''}`;
  const options = Array.isArray(q?.options) ? q.options : [];
  return [
    { field: `the question text of ${where}`, text: q?.question },
    ...options.flatMap((o, i) => [
      { field: `the label of option ${i + 1} of ${where}`, text: o?.label },
      { field: `the description of option ${i + 1} of ${where}`, text: o?.description },
    ]),
  ];
}

const questionHits = (questions) => questions.flatMap((q, n) => fieldsOf(q, n).flatMap(({ field, text }) => speakerHits(text).map((h) => ({ field, ...h }))));

const blockMessage = (hits) => [
  `BLOCKED: this questionnaire uses "you", "I" or "we" for the two parties; in a questionnaire this project names them "Chris" and "Claude" (${SPEAKER_RULE_ID}, KIT-T1624).`,
  ...hits.slice(0, HITS_SHOWN).map((h) => `  "${h.word}" in ${h.field}: "${h.sentence.slice(0, SENTENCE_SHOWN_CHARS)}"`),
  ...(hits.length > HITS_SHOWN ? [`  ... and ${hits.length - HITS_SHOWN} more`] : []),
  '',
  'Fix: name the actor in each sentence: "Chris runs the installer", "Claude runs the timing", never "you run" or "I run"; "Chris\'s',
  'pick" for "your pick", "Claude and Chris" for "we". The rule covers the question text, option labels and option descriptions; the',
  'summary above the call and ordinary replies may use you and I. Words in double quotes and `code` are exempt.',
  '',
  excludeFooter(CHECK_ID),
].join('\n');

try {
  const p = await payload();
  if (p.tool_name && !TOOLS.has(p.tool_name)) process.exit(0);
  const questions = p.tool_input?.questions;
  const root = gitRoot();
  if (!Array.isArray(questions) || !questions.length || !adopted(root) || pathExcluded(root, CHECK_ID, root)) process.exit(0);
  if (!speakerRuleHeld(root)) process.exit(0);
  const hits = questionHits(questions);
  if (hits.length) {
    process.stderr.write(blockMessage(hits));
    process.exit(2);
  }
} catch {
  /* fail open */
}
process.exit(0);
