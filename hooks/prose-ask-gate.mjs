#!/usr/bin/env node
// Stop — a request to the maintainer written in prose instead of an AskUserQuestion (KIT-T1130, KIT-T1136). "If you
// need something, that needs to be a questionnaire or it's a process failure." The closing reply of the main thread
// is read; when it asks him for approval, a decision or an action and the turn made no questionnaire call that
// reached him, the stop is blocked ONCE per distinct sentence with the instruction to ask it properly.
//
// Exempt: a subagent's report (its requests go to the orchestrator), a turn with a questionnaire that reached him,
// and a turn whose maintainer message was itself a question (open discussion). Quoted text and code never count
// (lib/prose-ask.mjs). `stop_hook_active` allows; fails open on any error.
// Check-id: prose-ask (path glob matched against the project root, `.`).

import { firstSighting } from './block-once.mjs';
import { adopted, excludeFooter, gitRoot, pathExcluded, payload } from './lib.mjs';
import { proseAsks } from './lib/prose-ask.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { turnCalls, turnText } from './lib/turn-text.mjs';

const CHECK_ID = 'prose-ask';
const QUESTION_TOOLS = new Set(['AskUserQuestion', 'request_user_input']);
const SENTENCE_SHOWN_CHARS = 240;

const closingText = (p, turn) => (typeof p.last_assistant_message === 'string' && p.last_assistant_message.trim()
  ? p.last_assistant_message
  : [...(turn?.blocks || [])].reverse().find((b) => b.kind === 'text')?.text || '');

const message = (sentence) => [
  '',
  'Prose request to the maintainer (KIT-T1130, KIT-T1136): your closing reply asks him for something outside a questionnaire:',
  `  "${sentence.slice(0, SENTENCE_SHOWN_CHARS)}"`,
  'His rule: "If you need something, that needs to be a questionnaire or it\'s a process failure." Put it in an AskUserQuestion now:',
  'a plain summary first, the recommended option first with (Recommended) prepended to its label (q gates question). A choice you can',
  'make and reverse yourself: make it and report it, never park it in a trailing line. An action only he can perform is an option too.',
].join('\n');

try {
  const p = await payload();
  if (p.stop_hook_active || subagentId(p)) process.exit(0);
  const root = gitRoot();
  if (!adopted(root) || pathExcluded(root, CHECK_ID, '.')) process.exit(0);
  const turn = p.transcript_path ? turnText(p.transcript_path) : null;
  if (/\?$/.test(turn?.lastUser || '')) process.exit(0);
  const [sentence] = proseAsks(closingText(p, turn));
  if (!sentence) process.exit(0);
  if (p.transcript_path && turnCalls(p.transcript_path, QUESTION_TOOLS).some((c) => !c.denied)) process.exit(0);
  if (!firstSighting(`prose-ask-${p.session_id || 'nosession'}`, sentence)) process.exit(0);
  process.stderr.write(`${message(sentence)}\n${excludeFooter(CHECK_ID)}`);
  process.exit(2);
} catch {
  /* fail open */
}
process.exit(0);
