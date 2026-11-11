#!/usr/bin/env node
// PostToolUseFailure (Bash|PowerShell) — releases what the broker-wait gate counted for a call that never
// ran. The gate records a subagent's wait (and submit) before the command runs; when the failure text shows
// node or the shell never started the script (an unquoted path with a space, a missing module), the record
// is forgotten so the agent's one real wait is not blocked as polling. A failed submit whose output names no
// job id never reached the broker (a missing stdin file, a usage error): its record goes too, so the corrected
// resubmit is not denied as a verbatim repeat. A submit that got an id stays counted.
// Not a gate: always exit 0, fail-open on any error.

import { payload, gitRoot, adopted, readTurnState, writeTurnState } from './lib.mjs';
import { brokerCalls } from './lib/broker-calls.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { waitSlot, jobId, digest, hasJobId, neverStarted } from './lib/broker-wait-state.mjs';

const forgetOne = (list, value) => {
  const at = list.lastIndexOf(value);
  if (at >= 0) list.splice(at, 1);
};

try {
  const p = await payload();
  const agent = subagentId(p);
  const command = String(p.tool_input?.command || '').trim();
  const output = p.error ?? p.tool_response;
  const unstarted = neverStarted(output);
  const unqueued = unstarted || !hasJobId(output);
  if (!agent || !command) process.exit(0);
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);
  const slot = waitSlot(agent);
  const state = readTurnState(root, slot);
  if (!state) process.exit(0);
  for (const c of brokerCalls(command)) {
    if (c.script === 'wait' && unstarted) forgetOne(state.waited || [], jobId(c));
    if (c.script === 'submit' && unqueued) forgetOne(state.submits || [], digest(command));
  }
  writeTurnState(root, state, slot);
} catch { /* fail-open */ }
process.exit(0);
