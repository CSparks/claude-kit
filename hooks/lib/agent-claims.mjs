// agent-claims.mjs — one file, one writer, across every live agent of a checkout (KIT-T1114). The session write ledger cannot
// tell two subagents of an orchestrator apart (they share a session id) and lapses 15 minutes after a session's last write,
// so each writer records its own claims (checkout-holder.mjs): the files it changed, with the HEAD at the write. A write is
// refused when another live writer, of this session or any other, has a claim on that file that still stands: the file is
// dirty and no commit since the claim touched it. A writer's own claims never refuse it (a subagent's identity is its agent
// id, whatever session id its payloads carry). A claim ends when its agent stops
// (releaseAgent), lapses after its window (two hours for an agent, 15 minutes for a main thread), or is committed.
//
//   claimConflicts({ tree, session, agent, rel, now }) -> [claimant] other live writers whose standing claim covers `rel`
//   sameWriter(claimant, session, agent)                -> is the claimant this writer (agent id for a subagent, session for the main thread)
//   ownStandingClaim({ tree, agent, rel, now })         -> does this subagent itself hold an uncommitted claim on `rel`, under any session id
//   claimMessage({ rel, tree, claimants, footer })      -> the block message, naming each other writer
//   describeWriter(claimant)                            -> "agent <id> (<label>) of session <s>" or "the main thread of session <s>"

import { liveClaimants } from './checkout-holder.mjs';
import { committedSince, stillDirty } from './session-overlap.mjs';

const MAIN_THREAD = 'the main thread';

// A subagent is identified by its agent id alone: the session id on its hook payloads can change during its life (the
// dispatching session continued under a new id), so a claim recorded under the old id is still the agent's own.
export const sameWriter = (c, session, agent) => (agent ? c.agent === agent : !c.agent && c.session === session);

export function ownStandingClaim({ tree, agent = '', rel, now = Date.now() }) {
  if (!agent) return false;
  return liveClaimants(tree, now).some((c) => c.agent === agent && Object.hasOwn(c.claims || {}, rel) && !committedSince(tree, rel, c.claims[rel]));
}

export function claimConflicts({ tree, session, agent = '', rel, now = Date.now() }) {
  const others = liveClaimants(tree, now).filter((c) => !sameWriter(c, session, agent) && Object.hasOwn(c.claims || {}, rel));
  if (!others.length || !stillDirty(tree, [rel]).has(rel)) return [];
  return others.filter((c) => !committedSince(tree, rel, c.claims[rel]));
}

export const describeWriter = (c) => `${c.agent ? `agent ${c.agent}${c.label ? ` (${c.label})` : ''}` : MAIN_THREAD} of session ${c.session}`;

export function claimMessage({ rel, tree, claimants, footer, mainThread = false }) {
  return [
    `BLOCKED: ${claimants.map(describeWriter).join(' and ')} changed ${rel} and has not committed it (KIT-T1114).`,
    `  tree: ${tree}`,
    '',
    'Two writers on one file lose work. Edit another file, or wait until that writer commits this one or stops; a writer',
    'on other files is never in your way. Your own files always pass.',
    ...(mainThread ? ['If that writer is dead (killed by an API error: no stop event), release its claims with `claims --release <agent id> --reason "<why>"`', '(refused for an agent that wrote in the last 5 minutes).'] : []),
    '',
    footer,
  ].join('\n');
}
