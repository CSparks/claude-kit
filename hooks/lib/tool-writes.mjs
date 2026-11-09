// The ACCEPTED-WRITES ledger (KIT-T888): a file an Edit or Write tool of any session wrote, with the hash of its content
// as the tool left it. hand-write-detect exempts a dirty source file from a shell call's blame only while the file on
// disk still hashes to a ledger entry made after the call began, so a shell call that rewrote the file after the tool
// did, or that merely names a path, is still a hand write. Entries come from the PostToolUse hook alone (the write
// has landed and pre-write accepted it); the pre-write turn ledger is never the proof.
//
// Machine-local turn state shared by every session of the checkout, capped; every path fails open (a lost entry costs
// a missing exemption, never a missed hand write).

import { readTurnState, writeTurnState } from './turn-state.mjs';

const SLOT = 'toolwrites';
const ENTRIES_MAX = 300;

const entriesOf = (root) => {
  const state = readTurnState(root, SLOT) || {};
  return Array.isArray(state.entries) ? state.entries : [];
};

export function recordToolWrite(root, rel, hash, now = Date.now()) {
  if (!rel || !hash) return;
  writeTurnState(root, { entries: [...entriesOf(root), { p: rel, h: hash, ts: now }].slice(-ENTRIES_MAX) }, SLOT);
}

/** True when a tool wrote `rel` at or after `sinceMs` and the file's content `currentHash` is what the tool left. */
export const toolWriteProves = (root, rel, sinceMs, currentHash) => Boolean(currentHash)
  && entriesOf(root).some((e) => e && e.p === rel && e.h === currentHash && (e.ts || 0) >= sinceMs);
