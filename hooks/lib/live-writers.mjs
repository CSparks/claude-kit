// Which other writers are live in a checkout, for the delete rule of source-shell-gate (KIT-T1246): the main thread may
// remove an untracked file only when no live writer holds it.
//
//   fileHolders(root, rel, caller)         -> descriptions of the other live writers that may hold `rel`: a writer with a standing
//                                             claim on it (agent-claims.mjs), another live session whose write ledger still lists
//                                             it dirty (live-claims.mjs), and every live writer whose Edit or Write left the bytes
//                                             on disk now (the ledger), whether or not it claimed the file
//   otherLiveWriters(root, caller, opts)   -> descriptions of every live writer of the checkout other than `caller`
//   liveWritersFor(root, rel, caller)      -> fileHolders, else otherLiveWriters: who a file with no recorded writer may belong to
//   liveWriterNames(root, rel, caller)     -> liveWritersFor for a block text, [] when the registry cannot be read
//
// fileHolders, liveWritersFor and otherLiveWriters with `{ strict: true }` read the registry strictly and throw when it
// cannot be read: a caller that lifts a refusal on "no live writer" must keep the refusal on a throw (delete-judge.mjs).

import { describeWriter } from './agent-claims.mjs';
import { liveClaimants, liveHolders } from './checkout-holder.mjs';
import { gitTry } from './exec.mjs';
import { overlappingHolders } from './live-claims.mjs';
import { committedSince } from './session-overlap.mjs';
import { contentHashOf } from './shell-snapshot.mjs';
import { toolWriteEntries } from './tool-write-ledger.mjs';
import { writerAgent, writerId, writerSession } from './tool-writes.mjs';

const STRICT = Object.freeze({ strict: true });
const describeSession = (session, label) => `the ${label || 'writer'} of session ${session}`;
const unique = (names) => [...new Set(names)];

const sameWriter = (c, session, agent) => c.session === session && (c.agent || '') === agent;

// Writers whose tool left the bytes `rel` holds now and that are live: a claimant of that session and agent, or a holder of
// that session (any holder for a main thread, the holder of that agent for an agent).
function liveLedgerWriters(root, rel, caller, claimants, holders) {
  const hash = contentHashOf(root, rel);
  const writers = unique(toolWriteEntries(root, rel).filter((e) => hash && e.h === hash && e.w && e.w !== caller).map((e) => e.w));
  return writers.flatMap((w) => {
    const [session, agent] = [writerSession(w), writerAgent(w)];
    const live = claimants.some((c) => sameWriter(c, session, agent)) || holders.some((h) => h.session === session && (!agent || h.agent === agent));
    return live ? [describeWriter({ session, agent })] : [];
  });
}

export function fileHolders(root, rel, caller) {
  if (!gitTry(['rev-parse', '--git-dir'], root).ok) throw new Error(`git cannot read ${root}`);
  const session = writerSession(caller);
  const agent = writerAgent(caller);
  const claimants = liveClaimants(root, Date.now(), STRICT);
  const holders = liveHolders(root, Date.now(), STRICT);
  const claiming = claimants.filter((c) => !sameWriter(c, session, agent) && Object.hasOwn(c.claims || {}, rel) && !committedSince(root, rel, c.claims[rel]));
  const sessions = overlappingHolders({ tree: root, session, paths: [rel] }).map(({ holder }) => describeSession(holder.session, holder.label));
  return unique([...claiming.map(describeWriter), ...sessions, ...liveLedgerWriters(root, rel, caller, claimants, holders)]);
}

export function otherLiveWriters(root, caller, opts = {}) {
  const claimants = liveClaimants(root, Date.now(), opts).filter((e) => writerId(e.session, e.agent) !== caller).map(describeWriter);
  const sessions = liveHolders(root, Date.now(), opts).filter((h) => h.session !== writerSession(caller)).map((h) => describeSession(h.session, h.label));
  return unique([...claimants, ...sessions]);
}

export function liveWritersFor(root, rel, caller) {
  const holders = fileHolders(root, rel, caller);
  return holders.length ? holders : otherLiveWriters(root, caller, STRICT);
}

/** liveWritersFor for a block text: [] when the registry cannot be read. */
export function liveWriterNames(root, rel, caller) {
  try {
    return liveWritersFor(root, rel, caller);
  } catch {
    return [];
  }
}
