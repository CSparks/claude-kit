#!/usr/bin/env node
// Stop — a turn that ends idle while known faults are open (KIT-T1611, RDG-D194). Answering a status question or
// relaying an agent's report is never the end of a turn while faults stay open and no agent works them. When the main thread's closing reply names open faults (lib/open-fault-
// report.mjs: "known faults", "still open", "not fixed") or failing tests (lib/red-test-report.mjs), no agent on the
// project's roster is live (lib/live-roster.mjs), the turn sent no SendMessage that resumed one, and no questionnaire
// reached the maintainer, the stop is blocked ONCE per distinct sentence with the instruction to dispatch the next fault
// or put the genuine choice in a questionnaire.
//
// A dispatch in the turn passes only through the roster: a background agent's in-flight row is live, while a foreground
// agent that already returned leaves the turn idle again. A turn opened by his question is not exempt (the incident was
// a status answer). Exempt: a subagent's report, quoted text, code, negated faults ("no known faults"), a test on the
// project's red-by-design list. `stop_hook_active` allows; fails open on any error.
// Check-id: open-fault-dispatch (path glob matched against the project root, `.`). In a reply, a line under
// `// claude-kit-ignore-line open-fault-dispatch` (or a start/end block) is not read.

import { firstSighting } from './block-once.mjs';
import { adopted, excludeFooter, gitRoot, markerExcludedLines, pathExcluded, payload } from './lib.mjs';
import { liveRosterRows } from './lib/live-roster.mjs';
import { openFaultReports } from './lib/open-fault-report.mjs';
import { readEntries } from './lib/red-by-design.mjs';
import { unlistedReports } from './lib/red-by-design-match.mjs';
import { redTestReports } from './lib/red-test-report.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { turnCalls, turnText } from './lib/turn-text.mjs';

const CHECK_ID = 'open-fault-dispatch';
const QUESTION_TOOLS = new Set(['AskUserQuestion', 'request_user_input']);
const RESUME_TOOLS = new Set(['SendMessage']);
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

const reached = (file, tools) => turnCalls(file, tools).some((c) => !c.denied);

const message = ({ sentence, phrase }) => [
  '',
  `Open faults and no agent working them (KIT-T1611, RDG-D194): your closing reply says "${phrase}":`,
  `  "${sentence.slice(0, SENTENCE_SHOWN_CHARS)}"`,
  'Known open faults are worked without waiting to be asked again: a status answer or a relayed report never ends the turn idle',
  'while faults stay open, and no agent on the roster is live. Dispatch the next fault THIS turn (q gates agent for the tags; one writer at',
  'a time, read-only diagnosis alongside, RDG-D137), or put the genuine choice in an AskUserQuestion (summary first, recommended option',
  'first) while the work goes on. A fault outside the signed bill of work: ask him to sign it in, in the same questionnaire.',
].join('\n');

try {
  const p = await payload();
  if (p.stop_hook_active || !p.transcript_path || subagentId(p)) process.exit(0);
  const root = gitRoot();
  if (!adopted(root) || pathExcluded(root, CHECK_ID, '.')) process.exit(0);
  const reply = unmarked(closingText(p, turnText(p.transcript_path)));
  const red = unlistedReports(redTestReports(reply), reply, readEntries(root));
  const [report] = [...openFaultReports(reply), ...red];
  if (!report) process.exit(0);
  if (reached(p.transcript_path, QUESTION_TOOLS) || reached(p.transcript_path, RESUME_TOOLS)) process.exit(0);
  if (liveRosterRows(root).length) process.exit(0);
  if (!firstSighting(`open-fault-dispatch-${p.session_id || 'nosession'}`, report.sentence)) process.exit(0);
  process.stderr.write(`${message(report)}\n${excludeFooter(CHECK_ID)}`);
  process.exit(2);
} catch {
  /* fail open */
}
process.exit(0);
