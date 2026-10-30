// The session's HAND-WRITE ledger (KIT-T706): source files a shell call changed, which the pre-write gate
// never judged. commit-gate refuses a commit holding one; re-saving the file through Edit or Write
// (which pre-write judges) clears its entry.
//
// Machine-local turn state, per session, capped; every path fails open.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readTurnState, writeTurnState } from './turn-state.mjs';

const HAND_WRITES_MAX = 500;
const slotOf = (sid) => `handwrites-${String(sid).replace(/[^A-Za-z0-9_-]/g, '_')}`;

const filesOf = (root, sid) => {
  const state = readTurnState(root, slotOf(sid)) || {};
  return Array.isArray(state.files) ? state.files : [];
};

export function handWrites(root, sid) {
  return sid ? new Set(filesOf(root, sid)) : new Set();
}

/** The ledgered paths among `paths` (repo-relative, POSIX) still on disk: the files a commit may not carry yet. */
export function pendingHandWrites(root, sid, paths) {
  const ledger = handWrites(root, sid);
  return ledger.size ? paths.filter((p) => ledger.has(p) && existsSync(join(root, p))) : [];
}

export function addHandWrites(root, sid, rels) {
  if (!sid || !rels.length) return;
  const files = [...new Set([...filesOf(root, sid), ...rels])];
  writeTurnState(root, { files: files.slice(-HAND_WRITES_MAX) }, slotOf(sid));
}

export function clearHandWrite(root, sid, rel) {
  if (!sid || !rel) return;
  const files = filesOf(root, sid);
  if (files.includes(rel)) writeTurnState(root, { files: files.filter((f) => f !== rel) }, slotOf(sid));
}
