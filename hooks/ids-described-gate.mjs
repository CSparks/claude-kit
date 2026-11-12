#!/usr/bin/env node
// PreToolUse (AskUserQuestion|request_user_input) — a question or option that names a ticket, decision or question id
// must also say in words what that item is (KIT-D128). exit 2 = block. Check id: ids-described.
//
// The rule: every id in a question (header, question, option labels and descriptions) is looked up in the store; the
// same question must carry at least MIN_HITS of the title's distinctive words. A title-word match is checkable, and it
// catches the failing case where the text still reads as a question once the id is cut but never says what the item is.
// An id the store does not hold is not checked. Fails open on any error.

import { payload, gitRoot, adopted, pathExcluded, excludeFooter } from './lib.mjs';
import { itemTitle } from './lib/item-title.mjs';
import { stems, stemWords } from './lib/stems.mjs';
import { IDS_CHECK as CHECK_ID, IDS_MIN_HITS as MIN_HITS } from './lib/question-checks.mjs';

const TOOLS = new Set(['AskUserQuestion', 'request_user_input']);
const ID = /\b[A-Z][A-Z0-9]+-[TDQ]\d{1,4}\b/g;
const MAX_TITLE_SHOWN = 90;

const optionText = (o) => `${o?.label || ''} ${o?.description || ''}`;
const questionText = (q) => [q?.header, q?.question, ...(Array.isArray(q?.options) ? q.options.map(optionText) : [])].filter(Boolean).join(' ');

function undescribed(root, q) {
  const text = questionText(q);
  const said = stems(text.replace(ID, ' '));
  const lacking = [];
  for (const id of new Set(text.match(ID) || [])) {
    const title = itemTitle(root, id);
    if (!title) continue;
    const wanted = stemWords(title.replace(ID, ' '));
    const needed = Math.min(MIN_HITS, wanted.size);
    const found = [...wanted].filter(([stem]) => said.has(stem)).map(([, word]) => word);
    if (found.length < needed) lacking.push({ id, title, needed, looked: [...wanted.values()], found });
  }
  return lacking;
}

const wordList = (words) => (words.length ? words.join(', ') : 'none');

function blockMessage(found) {
  return [
    'BLOCKED: this questionnaire names an item by id without saying what it is (KIT-D128: the maintainer does not know items by id).',
    ...found.flatMap((f) => [
      `  ${f.id} — "${f.title.slice(0, MAX_TITLE_SHOWN)}"`,
      `    looked for ${f.needed} of its title words: ${wordList(f.looked)} (plural and hyphen forms match)`,
      `    found: ${wordList(f.found)}`,
    ]),
    '',
    'Fix: describe each item in plain words in the same question (its subject and what it does), then the id may follow as a pointer.',
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
  const found = questions.flatMap((q) => undescribed(root, q));
  if (found.length) {
    process.stderr.write(blockMessage(found));
    process.exit(2);
  }
} catch {
  /* fail open */
}
process.exit(0);
