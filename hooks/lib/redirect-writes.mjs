// redirect-writes.mjs — the files a shell command's own `>` redirects truncate (KIT-T1479). A redirect names its file, so the
// file is the caller's own work wherever it lands: in the repo the call ran in or another one, and in the same command that goes
// on to commit it, before any hook could see the file.
//
// Only a plain `>` (or `2>`, `&>`) counts: `>>` appends to a file that may be another writer's. A redirect inside quotes or a
// comment, in a command with a heredoc, or in a command whose quoting cannot be trusted is no redirect.
//
//   redirectedFiles(command, { start, shell, bases }) -> absolute paths the command redirects into, whether or not the redirect ran:
//     for a caller that proves the write by the file's mtime. A relative target is resolved against the directory after the `cd`
//     segments before its segment, and against each of `bases`.
//   redirectedBeforeCommit(command, { start, shell, bases }) -> the same, for a caller that has only the command text: those in a
//     segment before the commit segment that has run by the time the commit does (every operator from it to the commit is `&&`, or
//     every operator up to it is `;`). A redirect after `||`, `|` or `&`, behind a `;` that follows a conditional, or on the commit
//     segment itself stays out.
//   redirectedRepoPaths(command, { root, start, shell, bases }) -> the repo-relative paths of `root` among redirectedBeforeCommit.

import { isAbsolute, resolve } from 'node:path';
import { commandCwd } from './shell-cwd.mjs';
import { segments, toPath } from './shell-segments.mjs';
import { gitRootOfFile } from './paths.mjs';
import { repoRelative } from '../turn-writes.mjs';

const UNRESOLVABLE = /[$`*?]|^&|^\/dev\/|^nul$/i;
const TRUNCATING_REDIRECT = /(?<!>)>(?![>&|])\s*([^\s"'|;&<>)`]+)/g;
const HEREDOC = /<</;
const COMMENT = /(?:^|\s)#/;
const GIT_COMMIT = /\bgit\b[^]*?\bcommit\b/;
const QUOTED_SPAN = /"[^"]*"|'[^']*'/g;
const runsBefore = new Set(['&&', ';']);

const blankQuoted = (text) => text.replace(QUOTED_SPAN, (span) => ' '.repeat(span.length));

// Every truncating redirect of the command with the segment it sits in, and the segment the commit is in (-1 when none).
function scan(command, { shell }) {
  const text = String(command || '');
  const segs = segments(text, { shell });
  if (segs.ambiguous || HEREDOC.test(text)) return { hits: [], commit: -1, segs };
  const hits = [];
  let commit = -1;
  segs.forEach((seg, index) => {
    const bare = blankQuoted(seg.text);
    if (commit < 0 && GIT_COMMIT.test(bare)) commit = index;
    if (COMMENT.test(bare)) return;
    for (const m of bare.matchAll(TRUNCATING_REDIRECT)) {
      if (!UNRESOLVABLE.test(m[1])) hits.push({ target: toPath(m[1]), index });
    }
  });
  return { hits, commit, segs };
}

function resolved(command, hits, { start, shell, bases }) {
  const files = hits.flatMap(({ target, index }) => {
    if (isAbsolute(target)) return [target];
    const dirs = [commandCwd(command, start, { upto: index, shell }), ...bases];
    return dirs.map((dir) => resolve(dir, target));
  });
  return [...new Set(files)];
}

export function redirectedFiles(command, { start = process.cwd(), shell = '', bases = [] } = {}) {
  return resolved(command, scan(command, { shell }).hits, { start, shell, bases });
}

// Segment `index` has run when the commit segment does: only `&&` or `;` lie between them, and either every one is `&&` (the
// commit runs only if the segment did, and the segment is not itself the right side of `||` or `&`) or only `;` (and the start)
// come before the segment (it always runs).
function ranBeforeCommit(segs, index, commit) {
  const between = segs.slice(index + 1, commit + 1).map((s) => s.after);
  const before = segs.slice(1, index + 1).map((s) => s.after);
  const guarded = segs[index].after === '||' || segs[index].after === '&';
  return between.every((op) => runsBefore.has(op)) && (before.every((op) => op === ';') || (!guarded && between.every((op) => op === '&&')));
}

export function redirectedBeforeCommit(command, { start = process.cwd(), shell = '', bases = [] } = {}) {
  const { hits, commit, segs } = scan(command, { shell });
  const credited = hits.filter(({ index }) => commit > index && ranBeforeCommit(segs, index, commit));
  return resolved(command, credited, { start, shell, bases });
}

export function redirectedRepoPaths(command, { root, ...options }) {
  return redirectedBeforeCommit(command, options).filter((file) => gitRootOfFile(file) === root).map((file) => repoRelative(root, file)).filter(Boolean);
}
