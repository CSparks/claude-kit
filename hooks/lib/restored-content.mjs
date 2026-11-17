// A source file a shell call changed is no hand write when git put it back (KIT-T982, KIT-T963, KIT-T977, KIT-T933):
//   - its content equals HEAD's blob: a revert or a stash leaves no diff to gate and nothing to re-save;
//   - with git (or the restore-tree verb, restore-tree-call.mjs, KIT-T1340) in the command, its content equals a blob a
//     commit reachable from HEAD or a branch, tag or remote ref recorded for that path (history-blobs.mjs:
//     `git checkout <rev> -- <path>`, KIT-T1337);
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
import { segments } from './shell-segments.mjs';
import { leaderOf } from './inert-command.mjs';
import { toolWriteEntries } from './tool-write-ledger.mjs';
import { blobId, committedPathContent, headBlobs, variants } from './history-blobs.mjs';
import { restoreTreeCall } from './restore-tree-call.mjs';

const GIT_LEADER = /^git$/i;
const RESTORE_WINDOW_MS = 30 * 60 * 1000;

const runsGit = (command) => segments(String(command || '')).some(({ text }) => GIT_LEADER.test(leaderOf(text)) || restoreTreeCall(text));
const sha1 = (data) => createHash('sha1').update(data).digest('hex');
const sessionOf = (writer) => String(writer || '').split('|')[0];

function inObjectStore(root, ids) {
  try {
    const answer = execFileSync('git', ['cat-file', '--batch-check'], { cwd: root, input: `${ids.join('\n')}\n`, encoding: 'utf8', windowsHide: true });
    return answer.split('\n').some((line) => / blob \d+$/.test(line));
  } catch {
    return false;
  }
}

function sessionHashes(root, rel, session, now) {
  return new Set(toolWriteEntries(root, rel)
    .filter((e) => e.c === true && sessionOf(e.w) === session && now - (e.ts || 0) <= RESTORE_WINDOW_MS)
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
  for (const rel of committedPathContent(root, rels.filter((rel) => !restored.has(rel)), (rel) => variants(root, rel))) restored.add(rel);
  for (const rel of rels) if (!restored.has(rel) && replaysOwnWrite(root, rel, session, now)) restored.add(rel);
  return restored;
}
