#!/usr/bin/env node
// UserPromptSubmit — run the hand-back reconciler on every orchestrator turn (KIT-T822). Each recovery step the
// reconciler names (RESULT READY -> reopen, JOB LOST -> resubmit, a Handoff or dead agent -> successor) is printed to
// the model as context, once per distinct set per session, and recorded as an attempt so the Stop gate can name the
// step that did not happen. Prints nothing when no work is open. Fails open.

import { firstSighting } from './block-once.mjs';
import { adopted, gitRoot, pathExcluded, payload, readAgents } from './lib.mjs';
import { brokerDir, reconcileHandbacks } from './lib/handback.mjs';
import { noteAttempts } from './lib/handback-attempts.mjs';
import { QUEUED } from './lib/handback-queued.mjs';

const CHECK_ID = 'successor';

try {
  const p = await payload();
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);
  const items = reconcileHandbacks(root, readAgents(root), { sessionId: p.session_id }).filter((i) => !pathExcluded(root, CHECK_ID, i.ticket || i.job));
  if (!items.length) process.exit(0);
  if (!firstSighting(`handback-prompt-${p.session_id || 'nosession'}`, items.map((i) => `${i.key}:${i.step}`).join(','))) process.exit(0);
  noteAttempts(brokerDir(root), items.filter((i) => i.step !== QUEUED));
  process.stdout.write(`Worker hand-backs to resume (no maintainer input needed; KIT-D130):\n${items.map((i) => `  ${i.text}`).join('\n')}\n`);
} catch {
  /* the reconciler never wedges a prompt */
}
process.exit(0);
