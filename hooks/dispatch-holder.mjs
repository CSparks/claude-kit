// dispatch-holder.mjs — the checkout-holder check of the dispatch gate (KIT-T811, KIT-D123). A writer dispatched
// into a checkout while ANOTHER session has a live writer there is refused: the roster the other checks read
// belongs to the dispatching project, so only the machine-wide holder registry (lib/checkout-holder.mjs) sees a
// writer another session started. The holder's own session, read-only agents and a stale holder pass.
//
//   HOLDER_CHECK                                   -> the check-id (ignore-file key)
//   holderBlock({ tree, session, footer, now })    -> the block message, or null when no other session holds the tree
//   registerWriter({ tree, session, label, now })  -> record the allowed writer dispatch as the session's hold

import { HOLDER_WINDOW_MS, beatHolder, liveHolders } from './lib/checkout-holder.mjs';

export const HOLDER_CHECK = 'checkout-holder';
const MS_PER_MIN = 60 * 1000;

export function registerWriter({ tree, session, label, now = Date.now() }) {
  beatHolder({ tree, session, label, now });
}

export function holderBlock({ tree, session, footer, now = Date.now() }) {
  const others = liveHolders(tree, now).filter((h) => h.session !== session);
  if (!others.length) return null;
  return [
    `BLOCKED: another session holds this checkout with a live writer (KIT-T811, KIT-D123).`,
    `  tree: ${tree}`,
    ...others.map((h) => `    • session ${h.session}${h.label ? ` (${h.label})` : ''}, last write ${Math.round((now - h.beatAt) / MS_PER_MIN)} min ago`),
    '',
    'A second writer shares that session\'s HEAD and index: it polls half-written files and its commit sweeps the',
    'other\'s edits into the wrong change.',
    '',
    'Fix: SendMessage the holder session (its standing agent) the work, naming the FULL ticket ids (KIT-T###);',
    'it claims them with `t status <id> doing`, which lifts your Stop gate. Or wait: a holder with no write',
    `for ${HOLDER_WINDOW_MS / MS_PER_MIN} min, or whose agent stopped, no longer blocks. A read-only agent type, or`,
    '[read-only: <reason>] in the prompt, passes. Two writers need the maintainer\'s words: [maintainer-asked-parallel: <his words>].',
    '',
    footer,
  ].join('\n');
}
