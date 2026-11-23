#!/usr/bin/env node
// Stop — a red-test report with no fix agent dispatched (KIT-T1484, extending KIT-D168). A hand-back or capture that
// names failing tests is a fault to fix, not a note: when the main thread's closing reply, or a `cap` / `t new` command
// of the turn, reports failing tests (lib/red-test-report.mjs) and the turn made no Agent, Task or SendMessage call, the
// stop is blocked ONCE per distinct report with the instruction to dispatch a fix agent per failure group, or to say in
// the reply why one already runs.
//
// Exempt: a subagent's report (its reader is the orchestrator), a turn that dispatched, a reply that says a fix agent
// already runs, quoted text, code, past-tense fixes and negated counts (lib/red-test-report.mjs), and a closing-reply
// sentence that names a test on the project's red-by-design list (`.ai/red-by-design/`, written by `t red-by-design`,
// lib/red-by-design.mjs): named debt is no new fault, any other red still demands a fix agent. A capture is never exempt.
// `stop_hook_active` allows; fails open on any error.
// Check-id: red-test-dispatch (path glob matched against the project root, `.`). In a reply, a line under
// `// claude-kit-ignore-line red-test-dispatch` (or a start/end block) is not read.

import { firstSighting } from './block-once.mjs';
import { adopted, excludeFooter, gitRoot, markerExcludedLines, pathExcluded, payload } from './lib.mjs';
import { readEntries } from './lib/red-by-design.mjs';
import { unlistedReports } from './lib/red-by-design-match.mjs';
import { explainsFix, redTestReports } from './lib/red-test-report.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { turnCalls, turnText } from './lib/turn-text.mjs';

const CHECK_ID = 'red-test-dispatch';
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
const DISPATCH_TOOLS = new Set(['Agent', 'Task', 'SendMessage']);
const CAPTURE_SEGMENT = /^\s*(?:cap\s+\w+|t\s+new)\b|\bcap\.mjs\b/;
const SEGMENT_BREAK = /[;&|]+/;
const SENTENCE_SHOWN_CHARS = 200;
const MARKER_LINE = /claude-kit-ignore/;

const closingText = (p, turn) => (typeof p.last_assistant_message === 'string' && p.last_assistant_message.trim()
  ? p.last_assistant_message
  : [...(turn?.blocks || [])].reverse().find((b) => b.kind === 'text')?.text || '');

function unmarked(text) {
  const { wholeFile, lines } = markerExcludedLines(text, CHECK_ID);
  if (wholeFile) return '';
  return text.split('\n').filter((line, i) => !lines.has(i + 1) && !MARKER_LINE.test(line)).join('\n');
}

const isCapture = (command) => command.split(SEGMENT_BREAK).some((segment) => CAPTURE_SEGMENT.test(segment));

const message = ({ sentence, phrase, source }) => [
  '',
  `Red test reported with no fix agent dispatched (KIT-T1484, extends KIT-D168): ${source} says "${phrase}":`,
  `  "${sentence.slice(0, SENTENCE_SHOWN_CHARS)}"`,
  'A failing test is a fault to fix, not a note: a capture or a relayed hand-back closes nothing. Dispatch a fix agent THIS turn for each',
  'failure group (q gates agent for the tags; one agent per root cause, the failing test named in the brief). A failure that already has',
  'a fix agent running: say so in the reply ("the fix agent for X is already running"). A fix landing in this same turn: say "fixed".',
  'A test red by design (a ruling or a signed-later fix): t red-by-design add <test> --decided-by <id> --reason "<why>" [--owner <who>]; a closing reply naming a listed test passes (a capture does not).',
].join('\n');

try {
  const p = await payload();
  if (p.stop_hook_active || !p.transcript_path || subagentId(p)) process.exit(0);
  const root = gitRoot();
  if (!adopted(root) || pathExcluded(root, CHECK_ID, '.')) process.exit(0);
  const turn = turnText(p.transcript_path);
  const reply = unmarked(closingText(p, turn));
  const captured = turnCalls(p.transcript_path, SHELL_TOOLS)
    .map((c) => String(c.input?.command || '')).filter(isCapture)
    .flatMap((command) => redTestReports(command, { raw: true }).map((r) => ({ ...r, source: 'a capture' })));
  const replied = unlistedReports(redTestReports(reply), reply, readEntries(root)).map((r) => ({ ...r, source: 'your closing reply' }));
  const [report] = [...replied, ...captured];
  if (!report) process.exit(0);
  if (turnCalls(p.transcript_path, DISPATCH_TOOLS).some((c) => !c.denied) || explainsFix(reply)) process.exit(0);
  if (!firstSighting(`red-test-dispatch-${p.session_id || 'nosession'}`, report.sentence)) process.exit(0);
  process.stderr.write(`${message(report)}\n${excludeFooter(CHECK_ID)}`);
  process.exit(2);
} catch {
  /* fail open */
}
process.exit(0);
