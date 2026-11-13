#!/usr/bin/env node
// Stop — a request to the maintainer, or "work waits on you", written in prose instead of an AskUserQuestion
// (KIT-T1130, KIT-T1136, KIT-T1151, GG-D088). "If you need something, that needs to be a questionnaire or it's a
// process failure." The closing reply of the main thread is read; when it asks him for approval, a decision or an
// action, or says it waits on him ("waiting on you", "your call", "up to you", "let me know"), and the turn made no
// questionnaire call that reached him, the stop is blocked ONCE per distinct sentence with the instruction to ask it
// properly, and a process-failure ticket is filed in the kit store (one open ticket per session).
//
// Exempt: a subagent's report (its requests go to the orchestrator, which relays them as a questionnaire), a turn
// with a questionnaire that reached him, and, for the soft asks only ("want me to", "let me know"), a turn whose
// maintainer message was itself a question (open discussion). A hard phrase ("waiting on you", "your call", "up to
// you", "which one is it") blocks there too (GG-D093). Quoted text, code and past-tense descriptions never count
// (lib/prose-ask.mjs). `stop_hook_active` allows; fails open on any error.
// Check-id: prose-ask (path glob matched against the project root, `.`). In a reply, a line under
// `// claude-kit-ignore-line prose-ask` (or a start/end block) is not read.

import { basename } from 'node:path';
import { firstSighting } from './block-once.mjs';
import { adopted, excludeFooter, gitRoot, markerExcludedLines, pathExcluded, payload } from './lib.mjs';
import { proseAskMatches } from './lib/prose-ask.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { turnCalls, turnText } from './lib/turn-text.mjs';

const CHECK_ID = 'prose-ask';
const QUESTION_TOOLS = new Set(['AskUserQuestion', 'request_user_input']);
const SENTENCE_SHOWN_CHARS = 240;

const closingText = (p, turn) => (typeof p.last_assistant_message === 'string' && p.last_assistant_message.trim()
  ? p.last_assistant_message
  : [...(turn?.blocks || [])].reverse().find((b) => b.kind === 'text')?.text || '');

function unmarked(text) {
  const { wholeFile, lines } = markerExcludedLines(text, CHECK_ID);
  if (wholeFile) return '';
  return text.split('\n').filter((_, i) => !lines.has(i + 1)).join('\n');
}

const message = ({ sentence, phrase }) => [
  '',
  `Prose request to the maintainer (KIT-T1130, KIT-T1136, KIT-T1151, GG-D088): your closing reply says "${phrase}" outside a questionnaire:`,
  `  "${sentence.slice(0, SENTENCE_SHOWN_CHARS)}"`,
  'His rule: "If you need something, that needs to be a questionnaire or it\'s a process failure." Send the AskUserQuestion THIS turn:',
  'a plain summary first, the recommended option first with (Recommended) prepended to its label (q gates question). No prose version of',
  'it, no rewording that keeps the ask. A choice you can make and reverse yourself: make it and report it, never park it in a trailing',
  'line. An action only he can perform is an option too. This stop is filed as a process failure in the kit store.',
].join('\n');

async function fileProcessFailure(root, sessionId, { sentence, phrase }) {
  try {
    const { fileKitBug } = await import('../scripts/kit-bug.mjs');
    const project = basename(root);
    fileKitBug({
      shape: `process-failure:prose-ask:${sessionId}`,
      title: `PROCESS FAILURE (${project} main thread): a reply said work waits on the maintainer ("${phrase}") with no questionnaire`,
      detail: `Stop gate prose-ask (KIT-T1151, GG-D088) blocked: ${sentence.slice(0, SENTENCE_SHOWN_CHARS)}`,
      project,
    });
  } catch {
    /* filing is best effort */
  }
}

try {
  const p = await payload();
  if (p.stop_hook_active || subagentId(p)) process.exit(0);
  const root = gitRoot();
  if (!adopted(root) || pathExcluded(root, CHECK_ID, '.')) process.exit(0);
  const turn = p.transcript_path ? turnText(p.transcript_path) : null;
  const discussion = /\?$/.test(turn?.lastUser || '');
  const [match] = proseAskMatches(unmarked(closingText(p, turn))).filter((m) => m.hard || !discussion);
  if (!match) process.exit(0);
  if (p.transcript_path && turnCalls(p.transcript_path, QUESTION_TOOLS).some((c) => !c.denied)) process.exit(0);
  const sessionId = p.session_id || 'nosession';
  if (!firstSighting(`prose-ask-${sessionId}`, match.sentence)) process.exit(0);
  await fileProcessFailure(root, sessionId, match);
  process.stderr.write(`${message(match)}\n${excludeFooter(CHECK_ID)}`);
  process.exit(2);
} catch {
  /* fail open */
}
process.exit(0);
