#!/usr/bin/env node
// PostToolUse (Agent|Task|Bash|PowerShell) — the RECEIPT NOTE (KIT-T1221). The landing-alert Stop gate blocks a closing reply
// that does not name what landed; this note puts the same `t receipt` lines in front of the main thread when a commit
// lands, so the reply carries them the first time. It fires on the main thread only, after a subagent hand-back (its pushes
// are in git by then) and after a shell call that commits, pushes, merges, pulls or rebases.
// One compact block lists the commits landed this turn that no earlier reply named by sha and no earlier note showed;
// a sha is shown once. Silent otherwise. Fails open on any error (exit 0).

import { existsSync } from 'node:fs';
import { adopted, gitRoot, payload, readTurnState, writeTurnState } from './lib.mjs';
import { unannouncedIn } from './lib/announced-landings.mjs';
import { landedThisTurn } from './lib/landed-commits.mjs';
import { FILL_LINE, commitLine } from './lib/receipt-lines.mjs';
import { subagentId } from './lib/subagent-id.mjs';
import { parseTranscript } from './lib/turn-transcript.mjs';

const RECEIPT_NOTE_SLOT = 'receipt-note';
const MAX_LISTED = 12;
const HAND_BACK_TOOLS = new Set(['Agent', 'Task']);
const SHELL_TOOLS = new Set(['Bash', 'PowerShell']);
const MOVES_HISTORY = /\bgit\b[^|;&\n]*\b(?:commit|push|merge|cherry-pick|pull|rebase)\b/i;

const triggers = (p) => HAND_BACK_TOOLS.has(p.tool_name) || (SHELL_TOOLS.has(p.tool_name) && MOVES_HISTORY.test(String(p.tool_input?.command || '')));

function noteText(root, fresh) {
  const lines = [`RECEIPT (KIT-T1221): ${fresh.length} commit(s) landed this turn, none named in a reply yet. Name each sha in the closing reply:`];
  lines.push(...fresh.slice(0, MAX_LISTED).map((c) => commitLine(root, c)));
  if (fresh.length > MAX_LISTED) lines.push(`  …+${fresh.length - MAX_LISTED} more (t receipt lists them)`);
  lines.push(FILL_LINE);
  return lines.join('\n');
}

try {
  const p = await payload();
  if (subagentId(p) || !triggers(p)) process.exit(0);
  const root = gitRoot();
  const tx = p.transcript_path;
  if (!adopted(root) || !tx || !existsSync(tx)) process.exit(0);
  const { turnStartMs } = parseTranscript(tx);
  if (!turnStartMs) process.exit(0);
  const earlier = readTurnState(root, RECEIPT_NOTE_SLOT);
  const shown = new Set(earlier?.turnStartMs === turnStartMs ? earlier.shown : []);
  const fresh = unannouncedIn(tx, landedThisTurn(root, turnStartMs)).filter((c) => !shown.has(c.sha));
  if (!fresh.length) process.exit(0);
  writeTurnState(root, { turnStartMs, shown: [...shown, ...fresh.map((c) => c.sha)] }, RECEIPT_NOTE_SLOT);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: noteText(root, fresh) } }));
} catch {
  /* fail open: a note never blocks a tool call */
}
process.exit(0);
