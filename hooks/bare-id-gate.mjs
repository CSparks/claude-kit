#!/usr/bin/env node
// Stop — a closing reply that carries ticket, decision, lever or run ids, or pastes a list of ids (KIT-T1462). The
// maintainer cannot read them: the thing is named by what it does, never by its id. A WARNING, never a block (exit 0):
// the notice reaches the next turn through stderr. Ids stay in briefs, commit messages, tickets and the record; a commit
// hash may appear only in the landing receipt, after the words.
//
// Reads the closing reply with the prose-ask scanner (lib/prose-ask.mjs, lib/bare-ids.mjs): code, quoted text and
// blockquotes never count, nor a landing-receipt commit line. A subagent's report is exempt (its reader is the
// orchestrator). Fails open on any error.
// Check-id: bare-ids (path glob matched against the project root, `.`). In a reply, a line under
// `// claude-kit-ignore-line bare-ids` (or a start/end block) is not read.

import { adopted, excludeFooter, gitRoot, markerExcludedLines, pathExcluded, payload, unboundedRoot } from './lib.mjs';
import { bareIdReport } from './lib/bare-ids.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { turnText } from './lib/turn-text.mjs';

const CHECK_ID = 'bare-ids';
const IDS_SHOWN = 8;

const closingText = (p, turn) => (typeof p.last_assistant_message === 'string' && p.last_assistant_message.trim()
  ? p.last_assistant_message
  : [...(turn?.blocks || [])].reverse().find((b) => b.kind === 'text')?.text || '');

function unmarked(text) {
  const { wholeFile, lines } = markerExcludedLines(text, CHECK_ID);
  if (wholeFile) return '';
  return text.split('\n').filter((_, i) => !lines.has(i + 1)).join('\n');
}

export const warning = ({ ids, pastedList }) => [
  '',
  'Ids the maintainer cannot read (KIT-T1462): your closing reply carries ' + (ids.length ? `${[...new Set(ids)].slice(0, IDS_SHOWN).join(', ')}` : 'a pasted list of ids') + '.',
  pastedList ? `  pasted list: ${pastedList.slice(0, 160)}` : '',
  'His rule: ticket, decision, lever and run ids are left out of replies to him, not even in brackets after the words. Name the thing by',
  'what it does ("the lane host gets the disk cache", not its id). A commit hash may appear only in the landing receipt, after the words.',
  'A list of agent or run ids a hook relayed is summarised, never pasted. Ids stay in briefs, commit messages, tickets and the record.',
  'Say it in plain words in the next reply; this is a warning, not a block.',
].filter(Boolean).join('\n');

try {
  const p = await payload();
  if (p.stop_hook_active || subagentId(p)) process.exit(0);
  const repoRoot = gitRoot();
  const root = adopted(repoRoot) ? repoRoot : unboundedRoot();
  if (!root || pathExcluded(root, CHECK_ID, '.')) process.exit(0);
  const turn = p.transcript_path ? turnText(p.transcript_path) : null;
  const report = bareIdReport(unmarked(closingText(p, turn)));
  if (!report.flagged) process.exit(0);
  process.stderr.write(`${warning(report)}\n${excludeFooter(CHECK_ID)}`);
} catch {
  /* fail open */
}
process.exit(0);
