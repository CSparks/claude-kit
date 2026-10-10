// foreign-tree-edits (KIT-T407): a writer dispatch into a checkout whose tracked source is
// already modified by someone this session cannot account for. The session's writes ledger
// (turn-writes.mjs) attributes edits; a live roster writer is the shared-tree check's business.
import { git } from './lib.mjs';
import { sessionWrites } from './turn-writes.mjs';

export const FOREIGN_TREE_CHECK = 'foreign-tree-edits';
export const FOREIGN_TREE_OK = /\[foreign-edits-ok:\s*[^\]\s][^\]]*\]/i;

// Modified/deleted/renamed TRACKED paths outside the .ai workflow store, repo-relative.
export function dirtyTrackedSource(tree) {
  return git(['-C', tree, 'status', '--porcelain', '--untracked-files=no'])
    .split('\n')
    .filter(Boolean)
    .map((l) => {
      const p = l.slice('XY '.length);
      return (p.includes(' -> ') ? p.split(' -> ').pop() : p).replace(/^"|"$/g, '');
    })
    .filter((p) => !p.startsWith('.ai/') && !p.includes('/.ai/'));
}

// Dirty paths this session did not write. [] without a session id: unattributable, fail open.
export function foreignEdits(tree, sessionId) {
  if (!sessionId) return [];
  const mine = sessionWrites(tree, sessionId);
  return dirtyTrackedSource(tree).filter((p) => !mine.has(p));
}

export function foreignTreeMessage({ agent, tree, files, footer }) {
  const shown = files.slice(0, 10);
  return [
    `BLOCKED: ${files.length} modified tracked file(s) in this tree are not attributable to this session — a second writer is in the tree (KIT-T407).`,
    `  agent: ${agent}   tree: ${tree}`,
    ...shown.map((f) => `    ${f}`),
    ...(files.length > shown.length ? [`    +${files.length - shown.length} more`] : []),
    '',
    'A writer dispatched here would share those edits and can commit them under its own message (596d1fc).',
    'Fix: wait for the other session to commit, or dispatch a READ-ONLY agent type; if the edits are',
    'known and safe: include [foreign-edits-ok: <reason>] in the prompt.',
    '',
    footer,
  ].join('\n');
}
