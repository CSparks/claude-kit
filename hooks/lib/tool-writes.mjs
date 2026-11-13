// The ACCEPTED-WRITES ledger (KIT-T888): a file an Edit or Write tool of any session wrote, with the hash of its content
// as the tool left it. Shell-call attribution (hand-write-detect, shell-writes) exempts a changed file only while the
// file on disk still hashes to a ledger entry made after the call began, so a shell call that rewrote the file after
// the tool did, or that merely names a path, still owns it.
//
// Two sources fill it. The PostToolUse recorder reads the hash off the landed file: a confirmed entry. pre-write also
// records the hash of the content the tool is about to leave (KIT-T949), only once every blocking check has passed:
// a session started before the recorder was wired never runs it, and the kit's writers are such sessions. A
// prediction is unconfirmed, so it gets no timing slack, and it proves nothing unless the file lands with exactly that
// content, so a write that was refused, or that a shell call changed afterwards, matches no entry. An entry names the
// writer (session and agent) and never exempts that writer's own shell call.
//
// Machine-local turn state shared by every session of the checkout, capped; every path fails open (a lost entry costs
// a missing exemption, never a missed hand write).
//
//   writerId(session, agent)                                         -> the identity an entry carries ('' when unknown)
//   recordToolWrite(root, rel, hash, now, writer)                    -> add a confirmed entry
//   recordPredictedWrite(root, rel, file, toolInput, writer, now)    -> add the unconfirmed entries for the content `toolInput` leaves
//   toolWriteProves(root, rel, sinceMs, currentHash, byWriter)       -> true when another writer's tool left `currentHash` in `rel` since `sinceMs`
//   movedWrite(root, rel, session)                                   -> true when git stages `rel` as the rename of a path whose confirmed entry holds exactly the staged content
//   cleanWriters(root, rel, currentHash)                             -> writers whose predicted write left `currentHash` and started from committed or their own clean-based text
//   predictedHashes(current, toolInput)                             -> hashes of the content an Edit or Write leaves ([] when unknown)

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { gitTry } from './exec.mjs';
import { readTurnState, writeTurnState } from './turn-state.mjs';

const SLOT = 'toolwrites';
const ENTRIES_MAX = 300;
const HASH_MAX_BYTES = 1 << 20;
const CONFIRMED_SLACK_MS = 5000;

const hashOf = (data) => createHash('sha1').update(data).digest('hex');
const toLf = (s) => s.replace(/\r\n/g, '\n');
const toCrlf = (s) => toLf(s).replace(/\n/g, '\r\n');

export const writerId = (session, agent) => (session ? `${session}|${agent || ''}` : '');
export const writerSession = (writer) => String(writer || '').split('|')[0];

const entriesOf = (root) => {
  const state = readTurnState(root, SLOT) || {};
  return Array.isArray(state.entries) ? state.entries : [];
};

const addEntries = (root, hashes, rel, now, writer, confirmed, clean = false) => {
  const added = hashes.map((h) => ({ p: rel, h, ts: now, w: writer, c: confirmed, ...(clean ? { k: true } : {}) }));
  writeTurnState(root, { entries: [...entriesOf(root), ...added].slice(-ENTRIES_MAX) }, SLOT);
};

export function recordToolWrite(root, rel, hash, now = Date.now(), writer = '') {
  if (rel && hash) addEntries(root, [hash], rel, now, writer, true);
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

const committedAndClean = (root, rel) => gitTry(['ls-files', '--error-unmatch', '--', rel], root).ok
  && gitTry(['diff', '--quiet', 'HEAD', '--', rel], root).ok;

// Did the edit start from content no other session's uncommitted work is in: the committed text, or the text this
// session's own earlier clean-based write left?
const startsClean = (root, rel, currentHash, session) => committedAndClean(root, rel)
  || entriesOf(root).some((e) => e.p === rel && e.h === currentHash && e.k === true && writerSession(e.w) === session);

export function recordPredictedWrite(root, rel, file, toolInput, writer = '', now = Date.now()) {
  try {
    if (!rel || !file) return;
    const isWrite = typeof (toolInput || {}).content === 'string';
    const bytes = isWrite || statSync(file).size > HASH_MAX_BYTES ? undefined : readFileSync(file);
    const hashes = predictedHashes(bytes === undefined ? undefined : bytes.toString('utf8'), toolInput);
    if (!hashes.length) return;
    const clean = isWrite || startsClean(root, rel, hashOf(bytes), writerSession(writer));
    addEntries(root, hashes, rel, now, writer, false, clean);
  } catch {
    /* an unreadable or new file has no prediction */
  }
}

/** The writers whose clean-based predicted write left exactly `currentHash` in `rel` (a Write, or an Edit on committed text). */
export const cleanWriters = (root, rel, currentHash) => entriesOf(root)
  .filter((e) => e && e.p === rel && e.h === currentHash && e.k === true).map((e) => e.w);

// The path git's staged rename detection says `rel` was renamed from, '' when it reports none.
function stagedRenameSource(root, rel) {
  const listing = gitTry(['diff', '--cached', '-M', '--name-status', '-z'], root);
  if (!listing.ok) return '';
  const parts = listing.out.split('\0');
  for (let i = 0; i < parts.length; i++) {
    const status = parts[i];
    if (/^[RC]/.test(status)) {
      if (status.startsWith('R') && parts[i + 2] === rel) return parts[i + 1];
      i += 2;
    } else {
      i += 1;
    }
  }
  return '';
}

/**
 * True when git reports `rel` as the staged rename of a path whose CONFIRMED ledger entry says a tool of `session` left
 * exactly the staged content there: the session wrote the file and moved it with git mv, so it is still the session's work
 * (KIT-T1134). One rename names one destination; an empty file, an unconfirmed prediction and a staged blob the tool did
 * not leave credit nothing.
 */
export function movedWrite(root, rel, session) {
  try {
    const from = session ? stagedRenameSource(root, rel) : '';
    if (!from) return false;
    const staged = execFileSync('git', ['-C', root, 'cat-file', 'blob', `:${rel}`], { maxBuffer: HASH_MAX_BYTES, stdio: ['ignore', 'pipe', 'ignore'] });
    if (!staged.length) return false;
    const hash = hashOf(staged);
    return entriesOf(root).some((e) => e && e.c === true && e.p === from && e.h === hash && writerSession(e.w) === session);
  } catch {
    return false;
  }
}

/** True when a tool of a writer other than `byWriter` wrote `rel` at or after `sinceMs` and `currentHash` is what it left. */
export const toolWriteProves = (root, rel, sinceMs, currentHash, byWriter = '') => Boolean(currentHash)
  && entriesOf(root).some((e) => e && e.p === rel && e.h === currentHash && !(byWriter && e.w === byWriter)
    && (e.ts || 0) >= sinceMs - (e.c ? CONFIRMED_SLACK_MS : 0));
