#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — the BROKER-WAIT gate (KIT-D115). A SUBAGENT may make ONE bounded wait on
// the broker (`wait.mjs <id>`, foreground, under 5 minutes: KIT-D104); everything else that parks a live
// context on the broker is denied, so the agent writes its handoff and ends and the orchestrator resumes it.
// The main thread is never gated.
//
// DENIED, from a subagent:
//   - run_in_background on a broker or cargo command (the agent would stay alive on it)
//   - a Bash timeout over 300000 ms
//   - watch.mjs / `broker.mjs watch|wait` (the orchestrator's tools), `submit.mjs --wait`
//   - wait.mjs with --timeout over 300 s, or a SECOND wait on the same job (polling)
//   - the same submit command repeated verbatim without --revises (re-running a job to read its status)
//   - sleep / while / until / for loops, `tail -f`, `Get-Content -Wait` around a broker call or target/broker
// Check-id: broker-wait (path glob subject: the checkout; in-source marker `# claude-kit-ignore broker-wait`).
// exit 2 = block, 0 = allow. No-ops on unadopted repos. Fail-open on any error.

import { createHash } from 'node:crypto';
import { payload, gitRoot, adopted, pathExcluded, markerExcludedLines, excludeFooter, readTurnState, writeTurnState } from './lib.mjs';
import { brokerCalls, usesCargo } from './lib/broker-calls.mjs';
import { subagentId } from './lib/subagent-id.mjs';

const CHECK_ID = 'broker-wait';
const MAX_TOOL_TIMEOUT_MS = 300000;
const MAX_WAIT_S = 300;
const DIGEST_CHARS = 12;
const BROKER_PATH = /(?:target|scripts)[\\/]broker|\b(?:submit|wait|watch|broker)\.mjs\b/i;
const LOOP = /(?:^|[;&|(\n]|\bdo|\bthen)\s*(?:sleep|start-sleep|while|until|for|foreach)\b|\btail\s+-\w*[fF]|\bget-content\b[^|;&]*-wait\b/i;
const flagValue = (words, name) => { const i = words.indexOf(name); return i >= 0 ? words[i + 1] : undefined; };
const digest = (text) => createHash('sha1').update(text).digest('hex').slice(0, DIGEST_CHARS);
const jobId = (call) => call.words.find((w) => /^j-/.test(w)) || call.sub;

function problems(command, input, state) {
  const calls = brokerCalls(command);
  const found = [];
  const background = input.run_in_background === true || input.run_in_background === 'true';
  if (background && (calls.length || usesCargo(command))) found.push('a broker or cargo command in the background: the agent stays alive on it');
  if (Number(input.timeout) > MAX_TOOL_TIMEOUT_MS) found.push(`a Bash timeout of ${input.timeout} ms: no call may run past 5 minutes`);
  for (const c of calls) {
    if (c.script === 'watch' || (c.script === 'broker' && /^(?:watch|wait)$/.test(c.sub))) found.push(`${c.script === 'broker' ? `broker.mjs ${c.sub}` : 'watch.mjs'}: following the checkout is the orchestrator's job`);
    if (c.words.includes('--wait')) found.push(`${c.script}.mjs --wait: a submit never waits`);
    if (c.script === 'wait') {
      if (Number(flagValue(c.words, '--timeout')) > MAX_WAIT_S) found.push(`wait.mjs --timeout over ${MAX_WAIT_S} s`);
      if (state.waited.includes(jobId(c))) found.push(`a second wait on ${jobId(c)}: that is polling`);
    }
    if (c.script === 'submit' && !c.words.includes('--revises') && state.submits.includes(digest(command))) found.push('the same submit repeated verbatim: re-running a job to read its status');
  }
  if (LOOP.test(command) && (calls.length || BROKER_PATH.test(command))) found.push('a sleep, poll or tail loop around the broker');
  return found;
}

const message = (found) => [
  '',
  'BLOCKED: waiting on the broker the wrong way (KIT-D115).',
  ...found.map((f) => `  - ${f}`),
  '',
  'A subagent submits, may wait ONCE with `wait.mjs <id> --root <tree> --timeout 280` in the foreground, and otherwise',
  'writes its handoff (job ids, state, next steps, file pointers in the ticket Notes) and ends with nothing running;',
  "the orchestrator resumes it from the broker's finished-job line (target/broker/finished.log). No polling, no loops,",
  'no background waits, no re-running a job to read it.',
  '',
].join('\n');

try {
  const p = await payload();
  const agent = subagentId(p);
  if (!agent) process.exit(0);
  const input = p.tool_input || {};
  const command = String(input.command || '').trim();
  if (!command) process.exit(0);
  const root = gitRoot();
  if (!adopted(root) || pathExcluded(root, CHECK_ID, root)) process.exit(0);
  const marks = markerExcludedLines(command, CHECK_ID);
  if (marks.wholeFile || marks.lines.size) process.exit(0);
  const slot = `brokerwait-${agent.replace(/[^\w-]/g, '_')}`;
  const state = { waited: [], submits: [], ...(readTurnState(root, slot) || {}) };
  const found = problems(command, input, state);
  if (found.length) {
    process.stderr.write(message(found) + excludeFooter(CHECK_ID));
    process.exit(2);
  }
  for (const c of brokerCalls(command)) {
    if (c.script === 'wait') state.waited.push(jobId(c));
    if (c.script === 'submit') state.submits.push(digest(command));
  }
  writeTurnState(root, state, slot);
  process.exit(0);
} catch {
  process.exit(0);
}
