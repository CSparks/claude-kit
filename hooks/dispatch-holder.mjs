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

export function registerWriter({ tree, session, label, origin, now = Date.now() }) {
  beatHolder({ tree, session, label, origin, now });
}

function describeHolder(h, now) {
  const from = h.origin ? `from ${h.origin}` : 'origin unknown (entry has no recorded project)';
  const agent = h.agent ? `agent ${h.agent}${h.label ? ` (${h.label})` : ''}` : h.label || 'no agent recorded';
  const roster = h.origin ? `; its agent roster: ${h.origin}/.ai/agents.jsonl` : '';
  return [
    `    • session ${h.session} ${from}, ${agent}, last write ${Math.round((now - h.beatAt) / MS_PER_MIN)} min ago`,
    `      entry: ${h.file}${roster}`,
  ];
}

export function holderBlock({ tree, session, footer, now = Date.now() }) {
  const others = liveHolders(tree, now).filter((h) => h.session !== session);
  if (!others.length) return null;
  return [
    `BLOCKED: another session holds this checkout with a live writer (KIT-T811, KIT-D123).`,
    `  tree: ${tree}`,
    ...others.flatMap((h) => describeHolder(h, now)),
    '',
    'Where this comes from: the machine-wide holder registry records a session when its writer is dispatched into this',
    'checkout or its Write/Edit lands on a source file in it (store .ai/ files never count). "from" is the repo that session',
    'itself works in.',
    `Stale? A hold lapses ${HOLDER_WINDOW_MS / MS_PER_MIN} min after the last write or when its agent stops. If that agent is dead, delete the`,
    'entry file above (rm it) to clear the hold now; the check re-registers on the holder\'s next write.',
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
