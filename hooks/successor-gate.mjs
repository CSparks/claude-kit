#!/usr/bin/env node
// Stop — the SUCCESSOR gate (KIT-T718, KIT-T822). Work a worker left open when it ended any way (hand-back, crash, usage
// limit, killed session) is recovered by the reconciler (lib/handback.mjs): a ready result -> reopen, a lost job ->
// resubmit or a fresh worker, a Handoff or a dead agent -> a successor. orient and the UserPromptSubmit hook surface each
// step; this gate blocks ONCE per distinct set only for what is still open, naming the step that did not happen
// (surfaced earlier and still open), the step not yet taken (first surfacing), or the case the reconciler cannot
// rebuild. `stop_hook_active` allows; fails open on any error.
// Check-id: successor (path glob matched against the ticket id).

import { firstSighting } from './block-once.mjs';
import { adopted, excludeFooter, gitRoot, pathExcluded, payload, readAgents } from './lib.mjs';
import { reconcileHandbacks, brokerDir } from './lib/handback.mjs';
import { noteAttempts, readAttempts } from './lib/handback-attempts.mjs';

const CHECK_ID = 'successor';
const UNRECOVERABLE = 'unrecoverable';

const lineOf = (item, attempts) => {
  const seen = attempts.get(item.key);
  if (item.step === UNRECOVERABLE) return `  CANNOT RECOVER (${item.step}): ${item.text}`;
  if (seen) return `  FAILED STEP ${item.step}: surfaced ${seen.count}x since ${seen.first}, not done. ${item.text}`;
  return `  NEXT STEP ${item.step}: ${item.text}`;
};

try {
  const p = await payload();
  if (p.stop_hook_active) process.exit(0);
  const root = gitRoot();
  if (!adopted(root)) process.exit(0);
  const items = reconcileHandbacks(root, readAgents(root)).filter((i) => !pathExcluded(root, CHECK_ID, i.ticket || i.job));
  if (!items.length) process.exit(0);
  const dir = brokerDir(root);
  const attempts = readAttempts(dir);
  const lines = items.map((i) => lineOf(i, attempts));
  if (!firstSighting(`successor-${p.session_id || 'nosession'}`, items.map((i) => i.key).join(','))) process.exit(0);
  noteAttempts(dir, items);
  process.stderr.write(`
BLOCKED: ${items.length} ended worker(s) left work open; the recovery step is below (KIT-T718, KIT-T822):
${lines.join('\n')}
Take each step (Agent / SendMessage / the command shown), then stop again. No maintainer input is needed (KIT-D130).
${excludeFooter(CHECK_ID)}`);
  process.exit(2);
} catch {
  /* a gate never wedges a stop on its own error */
}
process.exit(0);
