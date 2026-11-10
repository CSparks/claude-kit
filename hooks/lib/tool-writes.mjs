// The ACCEPTED-WRITES ledger (KIT-T888): a file an Edit or Write tool of any session wrote, with the hash of its content
// as the tool left it. Shell-call attribution (hand-write-detect, shell-writes) exempts a changed file only while the
// file on disk still hashes to a ledger entry made after the call began, so a shell call that rewrote the file after
// the tool did, or that merely names a path, still owns it.
//
// Two sources fill it. The PostToolUse recorder reads the hash off the landed file. pre-write also records the hash of
// the content the tool is about to leave (KIT-T949): a session started before the recorder was wired never runs it, and
// the kit's writers are such sessions. A prediction proves nothing unless the file lands with exactly that content, so a
// write that was refused, or that a shell call changed afterwards, matches no entry.
//
// Machine-local turn state shared by every session of the checkout, capped; every path fails open (a lost entry costs
// a missing exemption, never a missed hand write).
//
//   recordToolWrite(root, rel, hash, now)                 -> add an entry
//   recordPredictedWrite(root, rel, file, toolInput, now) -> add the entries for the content `toolInput` leaves in `file`
//   toolWriteProves(root, rel, sinceMs, currentHash)      -> true when a tool left `currentHash` in `rel` since `sinceMs`
//   predictedHashes(current, toolInput)                   -> hashes of the content an Edit or Write leaves ([] when unknown)

import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { readTurnState, writeTurnState } from './turn-state.mjs';

const SLOT = 'toolwrites';
const ENTRIES_MAX = 300;
const HASH_MAX_BYTES = 1 << 20;
const LAND_SLACK_MS = 5000;

const hashOf = (data) => createHash('sha1').update(data).digest('hex');
const toLf = (s) => s.replace(/\r\n/g, '\n');
const toCrlf = (s) => toLf(s).replace(/\n/g, '\r\n');

const entriesOf = (root) => {
  const state = readTurnState(root, SLOT) || {};
  return Array.isArray(state.entries) ? state.entries : [];
};

const addEntries = (root, hashes, rel, now) => {
  const added = hashes.map((h) => ({ p: rel, h, ts: now }));
  writeTurnState(root, { entries: [...entriesOf(root), ...added].slice(-ENTRIES_MAX) }, SLOT);
};

export function recordToolWrite(root, rel, hash, now = Date.now()) {
  if (rel && hash) addEntries(root, [hash], rel, now);
}

// The text an Edit leaves, by index surgery so a `$&` in the replacement stays literal; null when old_string is absent.
function editedText(current, ti) {
  const oldStr = toLf(ti.old_string);
  const newStr = toLf(ti.new_string ?? '');
  const lf = toLf(current);
  const at = lf.indexOf(oldStr);
  if (at === -1) return null;
  return ti.replace_all ? lf.split(oldStr).join(newStr) : lf.slice(0, at) + newStr + lf.slice(at + oldStr.length);
}

export function predictedHashes(current, toolInput) {
  const ti = toolInput || {};
  if (typeof ti.content === 'string') return [hashOf(ti.content)];
  if (typeof ti.old_string !== 'string' || typeof current !== 'string') return [];
  const text = editedText(current, ti);
  if (text === null) return [];
  return [...new Set([hashOf(text), ...(current.includes('\r\n') ? [hashOf(toCrlf(text))] : [])])];
}

export function recordPredictedWrite(root, rel, file, toolInput, now = Date.now()) {
  try {
    if (!rel || !file) return;
    const isWrite = typeof (toolInput || {}).content === 'string';
    const current = isWrite || statSync(file).size > HASH_MAX_BYTES ? undefined : readFileSync(file, 'utf8');
    const hashes = predictedHashes(current, toolInput);
    if (hashes.length) addEntries(root, hashes, rel, now);
  } catch {
    /* an unreadable or new file has no prediction */
  }
}

/** True when a tool wrote `rel` at or after `sinceMs` and the file's content `currentHash` is what the tool left. */
export const toolWriteProves = (root, rel, sinceMs, currentHash) => Boolean(currentHash)
  && entriesOf(root).some((e) => e && e.p === rel && e.h === currentHash && (e.ts || 0) >= sinceMs - LAND_SLACK_MS);
