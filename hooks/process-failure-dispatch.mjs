#!/usr/bin/env node
// Stop — a process-failure capture with no fix agent dispatched (KIT-D168, extending KIT-D145). A process failure is
// stop, capture naming the root cause, and DISPATCH an agent the same turn to fix the cause or build the prevention;
// a capture alone closes nothing. When the main thread ran a `cap` or `t new` command naming a process failure this
// turn and made no Agent, Task or SendMessage call, the stop is blocked ONCE per distinct capture.
// A subagent is exempt. `stop_hook_active` allows; fails open on any error.
// Check-id: process-failure-dispatch (path glob matched against the project root, `.`).

import { firstSighting } from './block-once.mjs';
import { adopted, excludeFooter, gitRoot, pathExcluded, payload } from './lib.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { turnCalls } from './lib/turn-text.mjs';

const CHECK_ID = 'process-failure-dispatch';
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
const DISPATCH_TOOLS = new Set(['Agent', 'Task', 'SendMessage']);
const CAPTURE = /\b(?:cap|t new)\b[^\n]*process[ -]failure/i;
const CAPTURE_SHOWN_CHARS = 160;

const message = (capture) => [
  '',
  'Process failure captured with no fix agent dispatched (KIT-D168, extends KIT-D145):',
  `  ${capture.replace(/\s+/g, ' ').slice(0, CAPTURE_SHOWN_CHARS)}`,
  'His rule: every process failure is followed by dispatching an agent to fix the cause or build the prevention. A capture alone',
  'does not close one. Dispatch it now (q gates agent for the tags); a kit-side cause goes to the standing kit agent.',
].join('\n');

try {
  const p = await payload();
  if (p.stop_hook_active || !p.transcript_path || subagentId(p)) process.exit(0);
  const root = gitRoot();
  if (!adopted(root) || pathExcluded(root, CHECK_ID, '.')) process.exit(0);
  const capture = turnCalls(p.transcript_path, SHELL_TOOLS).map((c) => String(c.input?.command || '')).find((c) => CAPTURE.test(c));
  if (!capture) process.exit(0);
  if (turnCalls(p.transcript_path, DISPATCH_TOOLS).some((c) => !c.denied)) process.exit(0);
  if (!firstSighting(`process-failure-dispatch-${p.session_id || 'nosession'}`, capture)) process.exit(0);
  process.stderr.write(`${message(capture)}\n${excludeFooter(CHECK_ID)}`);
  process.exit(2);
} catch {
  /* fail open */
}
process.exit(0);
