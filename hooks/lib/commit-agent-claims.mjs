// commit-agent-claims.mjs — a commit takes no path another live writer holds uncommitted work in (KIT-T1256). Every writer of a
// checkout shares ONE git index: a file another agent staged rides into this agent's commit under its message. The session
// write ledger cannot tell two agents of one session apart, so this reads the per-writer claims (checkout-holder.mjs): a path
// is foreign when another live writer's claim on it stands (dirty, uncommitted since the claim, agent-claims.mjs) and this
// writer holds none. Store (.ai/) paths and submodule gitlinks carry no claims and are never judged.
//
//   foreignClaims({ tree, session, agent, paths, now }) -> [{ rel, claimants }] paths of `paths` held by another live writer
//   foreignClaimMessage({ found, paths, messageArg, footer }) -> the block message: who holds what, and the commit that leaves
//                                                             their staged work staged (a commit by explicit path)

import { liveClaimants } from './checkout-holder.mjs';
import { claimConflicts, describeWriter } from './agent-claims.mjs';

const STORE_DIR = '.ai/';
const MAX_SHOWN = 10;

export function foreignClaims({ tree, session, agent = '', paths, now = Date.now() }) {
  const mine = liveClaimants(tree, now).filter((c) => c.session === session && (c.agent || '') === agent);
  return paths
    .filter((rel) => !rel.startsWith(STORE_DIR) && !mine.some((c) => Object.hasOwn(c.claims || {}, rel)))
    .flatMap((rel) => {
      const claimants = claimConflicts({ tree, session, agent, rel, now });
      return claimants.length ? [{ rel, claimants }] : [];
    });
}

export function foreignClaimMessage({ found, paths, messageArg, footer }) {
  const foreign = new Set(found.map((f) => f.rel));
  const own = paths.filter((p) => !foreign.has(p)).map((p) => (/\s/.test(p) ? `"${p}"` : p));
  const more = (list) => (list.length > MAX_SHOWN ? [`  +${list.length - MAX_SHOWN} more`] : []);
  return [
    '',
    `BLOCKED: ${found.length} path(s) this commit would take are uncommitted work of another live writer (KIT-T1256).`,
    '',
    ...found.slice(0, MAX_SHOWN).map((f) => `  ${f.rel}: ${f.claimants.map(describeWriter).join(' and ')}`),
    ...more(found),
    '',
    'Every writer of this checkout shares one git index, so a bare `git commit` (or one after your `git add`) takes what',
    'they staged under your message. A commit by explicit path takes only those paths and leaves their staged work staged:',
    `  git commit ${messageArg} -- ${own.length ? own.slice(0, MAX_SHOWN).join(' ') : '<your own paths>'}${own.length > MAX_SHOWN ? ' ...' : ''}`,
    'Do not `git restore --staged` their paths: that unstages their work.',
    'Their paths intended (you are finishing that writer\'s work): add [commit-foreign: <reason>] to the message.',
    '',
    footer,
  ].join('\n');
}
