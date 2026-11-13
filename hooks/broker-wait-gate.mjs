#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — the BROKER-WAIT gate (KIT-D115). A SUBAGENT may make ONE bounded wait on
// the broker (`wait.mjs <id>`, foreground, under 5 minutes: KIT-D104); everything else that parks a live
// context on the broker is denied, so the agent writes its handoff and ends and the orchestrator resumes it.
// The main thread is never gated.
//
// DENIED, from a subagent:
//   - run_in_background on a broker or cargo command (the agent would stay alive on it)
//   - run_in_background on a build or test tool (cmake, ctest, msbuild, ninja, make, gradle, ...): a subagent has no
//     way to wait on it and SubagentStop ends its shells, so a build past one 300000 ms call goes in a Handoff
//   - a Bash timeout over 300000 ms
//   - watch.mjs / `broker.mjs watch|wait` (the orchestrator's tools), `submit.mjs --wait`
//   - wait.mjs with --timeout over 300 s, or a SECOND wait on the same job (polling)
//   - the same submit command repeated verbatim without --revises (re-running a job to read its status)
//   - sleep / while / until / for loops, `tail -f`, `Get-Content -Wait` around a broker call or target/broker
//   - a sleep over 10 s, Wait-Process, Wait-Job or `timeout /t` anywhere (long-waits.mjs)
// Check-id: broker-wait (path glob subject: the checkout; in-source marker `# claude-kit-ignore broker-wait`).
// exit 2 = block, 0 = allow. No-ops on unadopted repos. Fail-open on any error.

import { payload,gitRoot, adopted, pathExcluded, markerExcludedLines, excludeFooter, readTurnState, writeTurnState } from './lib.mjs';
import { brokerCalls, usesCargo, usesTool } from './lib/broker-calls.mjs';
import { withoutDataArguments, withoutInlineCode } from './lib/command-leads.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { waitSlot, jobId, digest } from './lib/broker-wait-state.mjs';
import { longWaits } from './lib/long-waits.mjs';
import { BROKER_DIR } from './lib/broker-dir.mjs';
import { HARNESS_FOREGROUND_S, MAX_FOREGROUND_WAIT_S } from '../scripts/broker/wait-limits.mjs';

const CHECK_ID = 'broker-wait';
const MAX_TOOL_TIMEOUT_MS = 300000;
const MAX_WAIT_S = 300;
const BROKER_STATE = /target[\\/]broker/i;
const BUILD_TOOL = /^(?:cmake|ctest|msbuild|ninja|make|mingw32-make|nmake|devenv|xcodebuild|gradlew?|mvn|ant)(?:\.exe|\.bat|\.cmd)?$/i;
const AT_COMMAND = String.raw`(?:^|[;&|(\n]|\bdo|\bthen)\s*`;
const WAITING = new RegExp(`${AT_COMMAND}(?:sleep|start-sleep)\\b|\\btail\\s+-\\w*[fF]|\\bget-content\\b[^|;&]*-wait\\b`, 'i');
const POLL_LOOP = new RegExp(`${AT_COMMAND}(?:while|until)\\b(?!\\s+(?:IFS=\\S*\\s+)?read\\b)`, 'i');
const COUNT_LOOP = new RegExp(`${AT_COMMAND}(?:for|foreach)\\b`, 'i');
const flagValue = (words, name) => { const i = words.indexOf(name); return i >= 0 ? words[i + 1] : undefined; };

function problems(command, input, state) {
  const calls = brokerCalls(command);
  const found = [];
  const background = input.run_in_background === true || input.run_in_background === 'true';
  if (background && (calls.length || usesCargo(command))) found.push('a broker or cargo command in the background: the agent stays alive on it');
  else if (background && usesTool(command, BUILD_TOOL)) found.push('a build or test tool in the background: a subagent cannot wait on it and its shells end with it');
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
  const text = withoutDataArguments(command);
  const onBroker = calls.length || BROKER_STATE.test(text);
  const shell = withoutInlineCode(text);
  const polls = (WAITING.test(shell) || POLL_LOOP.test(shell)) && onBroker;
  if (polls || (COUNT_LOOP.test(shell) && calls.length)) found.push('a sleep, poll or tail loop around the broker');
  found.push(...longWaits(shell));
  return found;
}

const message = (found) => [
  '',
  'BLOCKED: waiting on the broker the wrong way (KIT-D115).',
  ...found.map((f) => `  - ${f}`),
  '',
  `A subagent submits, may wait ONCE with \`node "${BROKER_DIR}/wait.mjs" <id> --root <tree> --timeout ${MAX_FOREGROUND_WAIT_S}\` in the foreground, and otherwise`,
  'writes its handoff (job ids, state, next steps, file pointers in the ticket Notes) and ends with nothing running;',
  "the orchestrator resumes it from the broker's finished-job line (target/broker/finished.log). No polling, no loops,",
  'no background waits, no re-running a job to read it.',
  'An edit refused because another writer\'s cargo build is compiling the file waits with the one call that refusal names:',
  `\`builds --wait "<file>" --timeout ${MAX_FOREGROUND_WAIT_S} --tool-timeout ${HARNESS_FOREGROUND_S}\` (KIT-T1142), never a sleep or a loop.`,
  `The harness moves any foreground call to the background at ${HARNESS_FOREGROUND_S} s whatever its timeout (at most 300000 ms is`,
  'the ceiling, KIT-D104), so a build or test that cannot finish in one foreground call of about that length is scoped',
  'down (a narrower target, one test by name); if it still cannot fit, write a Handoff block in the ticket Notes naming',
  'the exact command and end: the orchestrator runs it in the background and resumes you.',
  'A call the harness already moved to the background ("moved to the background" notice): Read its output file at most',
  'once, never sleep, poll or wait on it, write the Handoff block and end.',
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
  const slot = waitSlot(agent);
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
