// The session's HAND-WRITE ledger (KIT-T706): source files a shell call changed, which the pre-write gate
// never judged. commit-gate refuses a commit holding one; re-saving the file through Edit or Write
// (which pre-write judges) clears its entry. An entry also lapses when a tool write confirmed AFTER the flag left exactly the
// content on disk: the flag was raised before that write's confirmation arrived (KIT-T1257).
//
// Machine-local turn state, per session, capped; every path fails open.
//
//   handWrites(root, sid) -> Set of flagged paths
//   addHandWrites(root, sid, rels, now?) / clearHandWrite(root, sid, rel)
//   pendingHandWrites(root, sid, paths) -> the flagged paths of `paths` a commit may not carry yet

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { unmovedHandWrites } from './identical-renames.mjs';
import { contentHashOf } from './shell-snapshot.mjs';
import { toolWriteEntries } from './tool-write-ledger.mjs';
import { readTurnState, writeTurnState } from './turn-state.mjs';

const HAND_WRITES_MAX = 500;
const slotOf = (sid) => `handwrites-${String(sid).replace(/[^A-Za-z0-9_-]/g, '_')}`;

const stateOf = (root, sid) => {
  const state = readTurnState(root, slotOf(sid)) || {};
  return { files: Array.isArray(state.files) ? state.files : [], at: state.at && typeof state.at === 'object' ? state.at : {} };
};

const save = (root, sid, files, at) => writeTurnState(root, { files, at: Object.fromEntries(files.map((f) => [f, at[f] || 0])) }, slotOf(sid));

export function handWrites(root, sid) {
  return sid ? new Set(stateOf(root, sid).files) : new Set();
}

// True when a tool write CONFIRMED at or after `flaggedAt` left exactly the file's content on disk, and the same writer's
// pre-write had predicted that content: the pre-write checks judged it, and the flag was raised before the confirmation landed.
function confirmedSince(root, rel, flaggedAt) {
  const hash = flaggedAt ? contentHashOf(root, rel) : '';
  const entries = hash ? toolWriteEntries(root, rel).filter((e) => e.h === hash) : [];
  return entries.some((c) => c.c === true && (c.ts || 0) >= flaggedAt && entries.some((p) => p.c !== true && p.w === c.w));
}

/** The ledgered paths among `paths` (repo-relative, POSIX) still on disk, not byte-identical git renames and not content a tool write confirmed after the flag: the files a commit may not carry yet. */
export function pendingHandWrites(root, sid, paths) {
  const { files, at } = stateOf(root, sid);
  const ledger = new Set(files);
  const held = ledger.size ? paths.filter((p) => ledger.has(p) && existsSync(join(root, p)) && !confirmedSince(root, p, at[p])) : [];
  return unmovedHandWrites(root, held);
}

export function addHandWrites(root, sid, rels, now = Date.now()) {
  if (!sid || !rels.length) return;
  const { files, at } = stateOf(root, sid);
  const merged = [...new Set([...files, ...rels])].slice(-HAND_WRITES_MAX);
  save(root, sid, merged, { ...at, ...Object.fromEntries(rels.map((r) => [r, now])) });
}

export function clearHandWrite(root, sid, rel) {
  if (!sid || !rel) return;
  const { files, at } = stateOf(root, sid);
  if (files.includes(rel)) save(root, sid, files.filter((f) => f !== rel), at);
}
