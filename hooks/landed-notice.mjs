#!/usr/bin/env node
// UserPromptSubmit + PostToolUse(Task|Agent|SendMessage) — LANDED SINCE LAST REPLY (KIT-T1379). When a hand-back, task
// notification, message or prompt arrives, the commits the coordinator has to name (landed this turn or not pushed, in the
// project and its submodules, not yet named by sha) are put in its context, each listed once per session
// (lib/landed-since-reply.mjs). A task notification continues the turn; a real prompt starts a new one, so only unpushed
// commits count then. Prints nothing when nothing new landed. Fails open.

import { existsSync } from 'node:fs';
import { adopted, gitRoot, payload, readTurnState, writeTurnState } from './lib.mjs';
import { isSystemNotice, parseTranscript } from './lib/turn-transcript.mjs';
import { noticeLines, pendingLandings } from './lib/landed-since-reply.mjs';

const MAX_REMEMBERED = 200;

try {
  const p = await payload();
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);
  const event = p.hook_event_name || '';
  const tx = p.transcript_path && existsSync(p.transcript_path) ? p.transcript_path : '';
  const continues = event !== 'UserPromptSubmit' || isSystemNotice(String(p.prompt || ''));
  const turnStartMs = continues && tx ? parseTranscript(tx).turnStartMs || 0 : 0;
  const slot = `landed-notice-${String(p.session_id || 'nosession').replace(/[^\w-]/g, '_')}`;
  const state = readTurnState(root, slot) || {};
  const pending = pendingLandings({ root, turnStartMs, transcript: tx });
  const lines = noticeLines(pending, state.listed || []);
  if (lines.length) {
    writeTurnState(root, { listed: [...new Set([...(state.listed || []), ...pending.map((c) => c.sha)])].slice(-MAX_REMEMBERED) }, slot);
    const text = lines.join('\n');
    process.stdout.write(event === 'UserPromptSubmit' ? `${text}\n` : JSON.stringify({ hookSpecificOutput: { hookEventName: event, additionalContext: text } }));
  }
} catch {
  /* a notice never wedges a prompt or a tool call */
}
process.exit(0);
