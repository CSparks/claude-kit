#!/usr/bin/env node
// PreToolUse (Bash|PowerShell|Monitor) — the BROKER-LOG gate (KIT-T697, KIT-T633). An agent that
// follows or searches the broker's daemon log (`tail -F …/target/broker/logs/daemon-*.log | grep`)
// leaves the pipeline running after its shell dies, and every orphan polls the disk. The broker
// answers the same questions: `wait.mjs <id>` follows one job, `watch.mjs --for landing|suite|any`
// follows the checkout, `broker.mjs status` shows health and the last suite.
//
// BLOCKED, on a path under `broker/logs` or `broker/lanes/<lane>/logs`:
//   - a follow: `tail -f/-F/--follow`, `Get-Content -Wait`
//   - any read or search of a daemon log, or of a glob over the logs directory
// ALLOWED: a one-shot read of ONE named job log (`logs/<job>-<n>.log`), the failure-inspection case.
// Check-id: broker-log (path glob subject: the log path; in-source marker `# claude-kit-ignore broker-log`).
// exit 2 = block, 0 = allow. No-ops on unadopted repos. Fail-open on any error.

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AMBIGUOUS_MESSAGE, segments } from './lib/shell-segments.mjs';
import { payload, gitRoot, adopted, pathExcluded, markerExcludedLines, excludeFooter } from './lib.mjs';

const CHECK_ID = 'broker-log';
const BROKER_DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), 'scripts', 'broker').replace(/\\/g, '/');

const LOGS_PATH = /broker[\\/](?:lanes[\\/][^\\/\s"']+[\\/])?logs(?:[\\/]|$)|\blanes[\\/][^\\/\s"']+[\\/]logs(?:[\\/]|$)/i;
const READ_TOOLS = 'grep|egrep|fgrep|rg|ag|ack|sed|awk|findstr|select-string|sls|cat|head|tail|type|get-content|gc|less|more';
const READ_TOOL = new RegExp(`^(?:${READ_TOOLS})$`);
const READ_TOOL_WORD = new RegExp(`\\b(?:${READ_TOOLS})\\b`, 'i');
const FOLLOW_FLAG = { tail: /^(?:-[A-Za-z]*[fF][A-Za-z]*|--follow(?:=\S+)?)$/, 'get-content': /^-wait$/i, gc: /^-wait$/i };
const DAEMON_LOG = /daemon-[^\\/\s"']*\.log\b/i;
const GLOB = /[*?]/;

const unquote = (t) => t.replace(/^["']|["']$/g, '');

function judge(segment) {
  const words = segment.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  const tool = words[0].replace(/.*[\/]/, '').toLowerCase();
  if (!READ_TOOL.test(tool)) return null;
  const logs = words.slice(1).map(unquote).filter((w) => LOGS_PATH.test(w));
  if (!logs.length) return null;
  const follows = !!FOLLOW_FLAG[tool] && words.slice(1).some((w) => FOLLOW_FLAG[tool].test(w));
  const broad = logs.some((w) => DAEMON_LOG.test(w) || GLOB.test(w) || /logs[\/]?$/i.test(w));
  return follows || broad ? { logs, follows } : null;
}

const message = (hit) => [
  '',
  `BLOCKED: ${hit.follows ? 'following' : 'searching'} the broker log (${hit.logs[0]}).`,
  'The pipeline outlives the shell that started it and polls the disk until someone kills it. The broker already reports what you are watching for:',
  `  - one job:        node ${BROKER_DIR}/wait.mjs <id> --root <checkout>`,
  `  - next landing / suite run / any finished job, all lanes:`,
  `                    node ${BROKER_DIR}/watch.mjs --root <checkout> --for landing|suite|any [--timeout 540] [--since <ISO>]`,
  `  - health, queue, last suite:  node ${BROKER_DIR}/broker.mjs status --root <checkout>`,
  'A one-shot read of ONE job log (logs/<job>-<n>.log) is allowed.',
  '',
].join('\n');

try {
  const p = await payload();
  const command = String(p.tool_input?.command || '').trim();
  if (!command) process.exit(0);
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);
  const marks = markerExcludedLines(command, CHECK_ID);
  if (marks.wholeFile || marks.lines.size) process.exit(0);
  const parts = segments(command);
  if (parts.ambiguous && LOGS_PATH.test(command) && READ_TOOL_WORD.test(command)) {
    process.stderr.write(`${message({ logs: [command.match(LOGS_PATH)[0]], follows: false })}${AMBIGUOUS_MESSAGE}\n${excludeFooter(CHECK_ID)}`);
    process.exit(2);
  }
  for (const { text } of parts) {
    const hit = judge(text);
    if (!hit || hit.logs.every((l) => pathExcluded(root, CHECK_ID, l))) continue;
    process.stderr.write(message(hit) + excludeFooter(CHECK_ID));
    process.exit(2);
  }
  process.exit(0);
} catch {
  process.exit(0);
}
