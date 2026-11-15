// Which other writers are live in a checkout, for the delete rule of source-shell-gate (KIT-T1246): the main thread may
// remove an untracked file only when no live writer holds it.
//
//   fileHolders(root, rel, caller)         -> descriptions of the other live writers whose standing claim covers `rel`: a live
//                                             agent or main thread (agent-claims.mjs), or another live session whose write
//                                             ledger still lists it dirty (live-claims.mjs)
//   otherLiveWriters(root, caller)         -> descriptions of every live writer of the checkout other than `caller`
//   liveWritersFor(root, rel, caller)      -> fileHolders, else otherLiveWriters: who a file with no recorded writer may belong to

import { describeWriter, claimConflicts } from './agent-claims.mjs';
import { liveClaimants, liveHolders } from './checkout-holder.mjs';
import { overlappingHolders } from './live-claims.mjs';
import { writerAgent, writerId, writerSession } from './tool-writes.mjs';

const describeSession = (session, label) => `the ${label || 'writer'} of session ${session}`;

export function fileHolders(root, rel, caller) {
  const session = writerSession(caller);
  const claimants = claimConflicts({ tree: root, session, agent: writerAgent(caller), rel }).map(describeWriter);
  const sessions = overlappingHolders({ tree: root, session, paths: [rel] }).map(({ holder }) => describeSession(holder.session, holder.label));
  return [...new Set([...claimants, ...sessions])];
}

export function otherLiveWriters(root, caller) {
  const claimants = liveClaimants(root).filter((e) => writerId(e.session, e.agent) !== caller).map(describeWriter);
  const sessions = liveHolders(root).filter((h) => h.session !== writerSession(caller)).map((h) => describeSession(h.session, h.label));
  return [...new Set([...claimants, ...sessions])];
}

export function liveWritersFor(root, rel, caller) {
  const holders = fileHolders(root, rel, caller);
  return holders.length ? holders : otherLiveWriters(root, caller);
}
