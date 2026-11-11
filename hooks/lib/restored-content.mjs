// A source file a shell call changed is no hand write when git put it back (KIT-T982, KIT-T963, KIT-T977, KIT-T933):
//   - its content equals HEAD's blob: a revert or a stash leaves no diff to gate and nothing to re-save;
//   - a git call put back content the calling session's own Edit or Write left: the ledger holds a CONFIRMED entry
//     of this session, made within RESTORE_WINDOW_MS, for these exact bytes (as-is, LF or CRLF), and git's object
//     store holds a blob of them (a stash, an index entry or a commit made it). pre-write judged that content when
//     it was written, so a stash pop or checkout bringing it back is no new authoring. A git segment in the command
//     is necessary and never enough.
// Equality is decided on blob ids computed here (the sha1 of `blob <size>\0<bytes>`, what `git hash-object
// --no-filters` prints), so no clean filter runs; any git failure means "not restored".
//
//   restoredSources(root, rels, command, { session, now }) -> Set of the paths in `rels` that git restored

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gitTry } from './exec.mjs';
import { segments } from './shell-segments.mjs';
import { leaderOf } from './shell-snapshot.mjs';
import { readTurnState } from './turn-state.mjs';

const CHUNK = 100;
const GIT_LEADER = /^git$/i;
const HASH_MAX_BYTES = 1 << 20;
const RESTORE_WINDOW_MS = 30 * 60 * 1000;
const LEDGER_SLOT = 'toolwrites';
const REGULAR_FILE_MODE = /^100(?:644|755)$/;

const runsGit = (command) => segments(String(command || '')).some(({ text }) => GIT_LEADER.test(leaderOf(text)));
const sha1 = (data) => createHash('sha1').update(data).digest('hex');
const blobId = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const sessionOf = (writer) => String(writer || '').split('|')[0];

/** The file's bytes as on disk, with CRLF read as LF, and with LF written as CRLF; [] when unreadable or large. */
function variants(root, rel) {
  try {
    const path = join(root, rel);
    if (statSync(path).size > HASH_MAX_BYTES) return [];
    const raw = readFileSync(path);
    const lf = raw.toString('utf8').replace(/\r\n/g, '\n');
    return [raw, Buffer.from(lf), Buffer.from(lf.replace(/\n/g, '\r\n'))];
  } catch {
    return [];
  }
}

function headBlobs(root, rels) {
  const blobs = new Map();
  for (let i = 0; i < rels.length; i += CHUNK) {
    const listing = gitTry(['ls-tree', '-z', 'HEAD', '--', ...rels.slice(i, i + CHUNK)], root);
    if (!listing.ok) continue;
    for (const entry of listing.out.split('\0').filter(Boolean)) {
      const [meta, path] = entry.split('\t');
      const [mode, type, id] = meta.split(' ');
      if (type === 'blob' && REGULAR_FILE_MODE.test(mode)) blobs.set(path, id);
    }
  }
  return blobs;
}

function inObjectStore(root, ids) {
  try {
    const answer = execFileSync('git', ['cat-file', '--batch-check'], { cwd: root, input: `${ids.join('\n')}\n`, encoding: 'utf8', windowsHide: true });
    return answer.split('\n').some((line) => / blob \d+$/.test(line));
  } catch {
    return false;
  }
}

function sessionHashes(root, rel, session, now) {
  const state = readTurnState(root, LEDGER_SLOT) || {};
  const entries = Array.isArray(state.entries) ? state.entries : [];
  return new Set(entries
    .filter((e) => e && e.p === rel && e.c === true && sessionOf(e.w) === session && now - (e.ts || 0) <= RESTORE_WINDOW_MS)
    .map((e) => e.h));
}

function replaysOwnWrite(root, rel, session, now) {
  const bytes = variants(root, rel);
  if (!session || !bytes.length) return false;
  const recorded = sessionHashes(root, rel, session, now);
  return bytes.some((b) => recorded.has(sha1(b))) && inObjectStore(root, bytes.slice(0, 2).map(blobId));
}

export function restoredSources(root, rels, command, { session = '', now = Date.now() } = {}) {
  const restored = new Set();
  const head = headBlobs(root, rels);
  for (const rel of rels) {
    if (variants(root, rel).slice(0, 2).map(blobId).includes(head.get(rel))) restored.add(rel);
  }
  if (!runsGit(command)) return restored;
  for (const rel of rels) if (!restored.has(rel) && replaysOwnWrite(root, rel, session, now)) restored.add(rel);
  return restored;
}
