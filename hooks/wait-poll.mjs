#!/usr/bin/env node
// PreToolUse (Read|Bash|PowerShell) — the WAIT-POLL gate (KIT-T355). Cost is per tool call
// (each call re-sends the transcript), so an agent that waits on a build by re-reading a
// background-task output file or by looping sleep/check burns hundreds of thousands of tokens
// while nothing changes. The rule lives in docs/wait-rule.md; this hook enforces it.
//
// Offences, counted per session:
//   - a Read or cat/tail/head/Get-Content of the SAME background-task output file more than twice
//   - a Bash command that sleeps (sleep / Start-Sleep / until…do sleep) around a check of a
//     build or output file
// Offences 1 and 2 WARN (stderr, exit 0); the 3rd and every later one BLOCKS (exit 2).
// Check-id: wait-poll (path glob subject: the output file, or the cwd for a sleep loop).
// No-ops on unadopted repos. Fail-open on any error.

import { readTurnState, writeTurnState, payload, gitRoot, adopted, pathExcluded, markerExcludedLines, excludeFooter } from './lib.mjs';
import { segments, toPath } from './lib/shell-segments.mjs';

const CHECK_ID = 'wait-poll';
const FREE_READS = 2;
const BLOCK_AT = 3;

const TASK_OUTPUT = /\.output$/i;
const BUILD_FILE = /\.output\b|\.log\b|[\\/]tasks[\\/]|\btarget[\\/]|\bbuild[\\/]|\bnpm-debug|\.out\b/i;
const READ_CMD = /^(?:cat|tail|head|type|get-content|gc|less|more)$/i;
const SLEEP_CMD = /(?:^|[\s;&|(])(?:sleep|start-sleep)\b/i;
const CHECK_CMD = /\b(?:tail|cat|head|ls|stat|wc|grep|get-content|gc|test|type)\b|\[\s+(?:!\s+)?-[fsde]\b|\btest-path\b/i;

const norm = (p) => toPath(p).replace(/\\/g, '/');

// With ambiguous quoting every task-output path in a command that holds a read command counts as read.
function rawOutputReads(command) {
  const words = command.split(/[\s'"`;|&()<>]+/).filter(Boolean);
  if (!words.some((w) => READ_CMD.test(w))) return [];
  return [...new Set(words.filter((w) => TASK_OUTPUT.test(w)).map(norm))];
}

function outputReads(toolName, input) {
  if (/^read$/i.test(toolName || '')) {
    const f = input.file_path || '';
    return TASK_OUTPUT.test(f) ? [norm(f)] : [];
  }
  const files = new Set();
  const parts = segments(input.command || '');
  if (parts.ambiguous) return rawOutputReads(input.command || '');
  for (const seg of parts) {
    const words = seg.text.trim().split(/\s+/).filter(Boolean);
    if (!words.length || !READ_CMD.test(words[0])) continue;
    for (const w of words.slice(1)) if (!w.startsWith('-') && TASK_OUTPUT.test(w.replace(/^["']|["']$/g, ''))) files.add(norm(w));
  }
  return [...files];
}

function isSleepLoop(command) {
  if (!SLEEP_CMD.test(command)) return false;
  const rest = command.replace(/(?:sleep|start-sleep)\s+[\w.:]+/gi, ' ');
  return BUILD_FILE.test(rest) && CHECK_CMD.test(rest);
}

const trunc = (s) => (s.length > 100 ? s.slice(0, 97) + '...' : s);

function message(n, what) {
  const head = n >= BLOCK_AT ? `BLOCKED (offence ${n}): polling a build instead of waiting once.` : `WARNING (offence ${n} of ${BLOCK_AT - 1} allowed): polling a build.`;
  return [
    '',
    head,
    `  ${what}`,
    '',
    'Every tool call re-sends the whole transcript; waiting by polling costs hundreds of thousands of tokens (KIT-T355).',
    'Rule (docs/wait-rule.md):',
    '  - Run a long build/test in ONE Bash call with the max timeout, or run_in_background and wait for the completion notification.',
    '  - Pipe the output through a filter keeping only failures, panics, assertion lines and the `test result` totals.',
    '  - Never poll an output file, never sleep-loop, never re-run a whole suite to see one test: run that test by name.',
    '',
  ].join('\n');
}

try {
  const p = await payload();
  const input = p.tool_input || {};
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);

  const command = input.command || '';
  const marks = markerExcludedLines(command, CHECK_ID);
  if (marks.wholeFile || marks.lines.size) process.exit(0);

  const slot = `waitpoll-${String(p.session_id || 'nosession').replace(/[^\w-]/g, '_')}`;
  const state = readTurnState(root, slot) || { reads: {}, offences: 0 };
  const events = [];

  for (const f of outputReads(p.tool_name, input)) {
    if (pathExcluded(root, CHECK_ID, f)) continue;
    state.reads[f] = (state.reads[f] || 0) + 1;
    if (state.reads[f] > FREE_READS) events.push(`read #${state.reads[f]} of ${f}`);
  }
  if (command && !pathExcluded(root, CHECK_ID, process.cwd()) && isSleepLoop(command)) events.push(`sleep/check loop: ${trunc(command)}`);

  let blocked = false;
  for (const what of events) {
    state.offences += 1;
    const text = message(state.offences, what);
    if (state.offences >= BLOCK_AT) { process.stderr.write(text + excludeFooter(CHECK_ID)); blocked = true; break; }
    process.stderr.write(text);
  }
  writeTurnState(root, state, slot);
  process.exit(blocked ? 2 : 0);
} catch {
  process.exit(0);
}
