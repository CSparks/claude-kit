// A source file a shell call changed is no hand write when git put it back (KIT-T982, KIT-T963, KIT-T977, KIT-T933):
//   - its content now equals HEAD: a revert or a stash leaves no diff to gate and nothing to re-save;
//   - git runs in the call and the content is what an Edit or Write of any session left earlier, in any line-ending
//     form (checkout rewrites LF as CRLF under autocrlf): pre-write judged it when it was written, so a stash pop or
//     checkout bringing it back is no new authoring.
// Without git in the call the second rule never applies (hand-write-detect's accepted-writes timing holds).
//
//   restoredSources(root, rels, command) -> Set of the paths in `rels` that git restored

import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gitTry } from './exec.mjs';
import { segments } from './shell-segments.mjs';
import { leaderOf } from './shell-snapshot.mjs';
import { toolWriteProves } from './tool-writes.mjs';

const CHUNK = 100;
const GIT_LEADER = /^git$/i;
const NO_TIME_LIMIT = 0;
const HASH_MAX_BYTES = 1 << 20;

const runsGit = (command) => segments(String(command || '')).some(({ text }) => GIT_LEADER.test(leaderOf(text)));
const names = (r) => new Set(r.ok ? r.out.split('\0').filter(Boolean) : []);
const sha1 = (text) => createHash('sha1').update(text).digest('hex');

function lineEndingHashes(root, rel) {
  try {
    const path = join(root, rel);
    if (statSync(path).size > HASH_MAX_BYTES) return [];
    const text = readFileSync(path, 'utf8');
    const lf = text.replace(/\r\n/g, '\n');
    return [...new Set([sha1(text), sha1(lf), sha1(lf.replace(/\n/g, '\r\n'))])];
  } catch {
    return [];
  }
}

function matchHead(root, rels) {
  const same = new Set();
  for (let i = 0; i < rels.length; i += CHUNK) {
    const chunk = rels.slice(i, i + CHUNK);
    const tracked = names(gitTry(['ls-tree', '--name-only', '-z', 'HEAD', '--', ...chunk], root));
    const differing = names(gitTry(['--literal-pathspecs', 'diff', '--name-only', '-z', 'HEAD', '--', ...chunk], root));
    for (const rel of chunk) if (tracked.has(rel) && !differing.has(rel)) same.add(rel);
  }
  return same;
}

export function restoredSources(root, rels, command) {
  const restored = matchHead(root, rels);
  if (!runsGit(command)) return restored;
  for (const rel of rels) {
    if (lineEndingHashes(root, rel).some((h) => toolWriteProves(root, rel, NO_TIME_LIMIT, h))) restored.add(rel);
  }
  return restored;
}
