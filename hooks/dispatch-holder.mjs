// dispatch-holder.mjs — the checkout-holder check of the dispatch gate (KIT-T811, KIT-D155, KIT-T1114). Several sessions
// writing one checkout is normal. A writer dispatch is refused only when the [paths:] it declares touch a file another
// live session has changed and not yet committed; the machine-wide holder registry (lib/checkout-holder.mjs) and the
// sessions' write ledgers name those files, because the roster the other checks read belongs to the dispatching project.
//
//   HOLDER_CHECK                                       -> the check-id (ignore-file key)
//   holderBlock({ tree, session, footer, paths, now }) -> the block message, or null when no other live session has uncommitted
//                                                         changes to a file in `paths`
//   registerWriter({ tree, session, label, now })      -> record the allowed writer dispatch as the session's hold

import { beatHolder } from './lib/checkout-holder.mjs';
import { overlapLines } from './lib/session-overlap.mjs';
import { overlappingHolders } from './lib/live-claims.mjs';

export const HOLDER_CHECK = 'checkout-holder';

export function registerWriter({ tree, session, label, origin, now = Date.now() }) {
  beatHolder({ tree, session, label, origin, now });
}

export function holderBlock({ tree, session, paths, footer, now = Date.now() }) {
  const found = overlappingHolders({ tree, session, paths, now });
  if (!found.length) return null;
  return [
    'BLOCKED: another live session has uncommitted changes to files this writer declares (KIT-D155).',
    `  tree: ${tree}`,
    ...overlapLines(found, now),
    '',
    'Two sessions writing one file lose work. Wait until that session commits those files, or declare [paths:] that avoid them.',
    'Sessions on other files raise no flag here.',
    '',
    footer,
  ].join('\n');
}
