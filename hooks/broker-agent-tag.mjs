#!/usr/bin/env node
// PreToolUse (Bash|PowerShell) — tag a SUBAGENT's broker calls (KIT-D115). Inserts ` --agent <id>` after
// `submit.mjs` / `wait.mjs` / `watch.mjs` so the broker records which agent submitted a job (the finished-job line names
// it) and refuses subagent-only violations itself, and gives every wait a timeout inside the harness's foreground
// window (wait-limits.mjs): `--timeout 170` when the call names none, and a Bash timeout that outlasts it, so the
// harness never has a long foreground call to move to the background. Emits updatedInput only. The main thread is untouched.
// Fail-open: a throw exits 0 untouched.

import { payload } from './lib.mjs';
import { brokerCalls } from './lib/broker-calls.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { HARNESS_FOREGROUND_S, MAX_FOREGROUND_WAIT_S, TOOL_MARGIN_S } from '../scripts/broker/wait-limits.mjs';

const DEFAULT_WAIT_S = MAX_FOREGROUND_WAIT_S;
const TOOL_SLACK_MS = TOOL_MARGIN_S * 1000;
const MAX_TOOL_TIMEOUT_MS = HARNESS_FOREGROUND_S * 1000;
const CALL = /(\bnode(?:\.exe)?\s+(?:--\S+\s+)*["']?(?:[^\s"';&|]*[\\/])?(submit|wait|watch)\.mjs["']?)(?=\s|$)/g;

try {
  const p = await payload();
  const agent = subagentId(p);
  const input = p.tool_input || {};
  const command = String(input.command || '');
  const calls = brokerCalls(command);
  if (!agent || !calls.some((c) => c.script === 'submit' || c.script === 'wait' || c.script === 'watch')) process.exit(0);
  const named = calls.find((c) => c.script === 'wait')?.words;
  const waitS = named && named.includes('--timeout') ? Number(named[named.indexOf('--timeout') + 1]) || DEFAULT_WAIT_S : DEFAULT_WAIT_S;
  const waits = calls.some((c) => c.script === 'wait');
  const toolMs = Math.min(waitS * 1000 + TOOL_SLACK_MS, MAX_TOOL_TIMEOUT_MS);
  const tagged = command.replace(CALL, (all, head, script) => {
    const agentFlag = /--agent\b/.test(command) ? '' : ` --agent ${agent}`;
    const timeoutFlag = script === 'wait' && !/--timeout\b/.test(command) ? ` --timeout ${DEFAULT_WAIT_S}` : '';
    const toolFlag = script === 'wait' && !/--tool-timeout\b/.test(command) ? ` --tool-timeout ${toolMs / 1000}` : '';
    return `${head}${agentFlag}${timeoutFlag}${toolFlag}`;
  });
  const timeout = waits ? { timeout: toolMs } : {};
  if (tagged === command && !waits) process.exit(0);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', updatedInput: { ...input, command: tagged, ...timeout } } }));
} catch { /* fail-open: an untagged call still runs */ }
process.exit(0);
