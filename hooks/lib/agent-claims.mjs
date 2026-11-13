// agent-claims.mjs — one file, one writer, across every live agent of a checkout (KIT-T1114). The session write ledger cannot
// tell two subagents of an orchestrator apart (they share a session id) and lapses 15 minutes after a session's last write,
// so each writer records its own claims (checkout-holder.mjs): the files it changed, with the HEAD at the write. A write is
// refused when another live writer, of this session or any other, has a claim on that file that still stands: the file is
// dirty and no commit since the claim touched it. A writer's own claims never refuse it. A claim ends when its agent stops
// (releaseAgent), lapses after its window (two hours for an agent, 15 minutes for a main thread), or is committed.
//
//   claimConflicts({ tree, session, agent, rel, now }) -> [claimant] other live writers whose standing claim covers `rel`
//   claimMessage({ rel, tree, claimants, footer })      -> the block message, naming each other writer

import { liveClaimants } from './checkout-holder.mjs';
import { committedSince, stillDirty } from './session-overlap.mjs';

const MAIN_THREAD = 'the main thread';

const sameWriter = (c, session, agent) => c.session === session && (c.agent || '') === agent;

export function claimConflicts({ tree, session, agent = '', rel, now = Date.now() }) {
  const others = liveClaimants(tree, now).filter((c) => !sameWriter(c, session, agent) && Object.hasOwn(c.claims || {}, rel));
  if (!others.length || !stillDirty(tree, [rel]).has(rel)) return [];
  return others.filter((c) => !committedSince(tree, rel, c.claims[rel]));
}

const describe = (c) => `${c.agent ? `agent ${c.agent}${c.label ? ` (${c.label})` : ''}` : MAIN_THREAD} of session ${c.session}`;

export function claimMessage({ rel, tree, claimants, footer }) {
  return [
    `BLOCKED: ${claimants.map(describe).join(' and ')} changed ${rel} and has not committed it (KIT-T1114).`,
    `  tree: ${tree}`,
    '',
    'Two writers on one file lose work. Edit another file, or wait until that writer commits this one or stops; a writer',
    'on other files is never in your way. Your own files always pass.',
    '',
    footer,
  ].join('\n');
}
