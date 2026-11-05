#!/usr/bin/env node
// UserPromptSubmit — print the OPEN-WORK notice for ended workers as context (KIT-T822, KIT-D132). The reconciler
// (lib/handback.mjs) lists what a retired worker left open; this hook prints it once per distinct set, per session, as a
// notice for the model to relay to the maintainer. It never orders a dispatch, reopen or resume. Prints nothing when no
// work is open. Fails open.

import { firstSighting } from './block-once.mjs';
import { adopted, gitRoot, pathExcluded, payload, readAgents } from './lib.mjs';
import { reconcileHandbacks } from './lib/handback.mjs';
import { openNotice } from './lib/bill-of-work.mjs';

const CHECK_ID = 'successor';

try {
  const p = await payload();
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);
  const items = reconcileHandbacks(root, readAgents(root), { sessionId: p.session_id }).filter((i) => !pathExcluded(root, CHECK_ID, i.ticket || i.job));
  if (!items.length) process.exit(0);
  if (!firstSighting(`handback-prompt-${p.session_id || 'nosession'}`, items.map((i) => `${i.key}:${i.step}`).join(','))) process.exit(0);
  process.stdout.write(`${openNotice(items.map((i) => `  ${i.text}`), `${items.length} ended worker(s) left work open (KIT-D132).`)}\n`);
} catch {
  /* the reconciler never wedges a prompt */
}
process.exit(0);
