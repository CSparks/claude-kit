// restore-tree/repo.mjs — the git and file-system reads and writes behind restore-tree; one function per question.
//
//   treeRoot(cwd) -> absolute git work-tree root (real path)
//   repoPaths(root, cwd, dirs) -> repo-relative posix paths of the directories; throws for one outside the repo, the repo root or inside .git
//   commitOf(root, rev) -> the full commit id `rev` names; throws for anything else
//   treeBlobs(root, commit, paths) -> Map path -> blob id of the regular files the commit holds under `paths`
//   trackedFiles(root, paths) -> Set of the tracked paths under `paths`
//   diskFiles(root, paths) -> Set of the files that exist under `paths`: tracked, or untracked and not ignored
//   sameBytes(root, path, blobId) -> the file on disk holds that blob, with CRLF read as LF
//   recoverablePaths(root, rels) -> Set of the `rels` whose bytes on disk some commit holds at that path (HEAD first, then history)
//   unrecoverableStaged(root, paths) -> the `paths` whose index blob no commit reachable from HEAD, a branch, a tag or a remote holds at that path (HEAD's own blob always passes)
//   dropStaged(root, paths, tracked) -> removes the index entries of those paths that `tracked` (the index's paths) holds
//   checkout(root, commit, files, { alsoIndex }) -> git writes the commit's version of each file into the work tree. The index is
//     untouched, except with alsoIndex (the commit is HEAD): those entries are set to HEAD's too, which is what leaves `git status`
//     clean for a file git wrote with CRLF line endings (a worktree-only restore leaves its index entry stale and status shows it modified)
//   removeFiles(root, files, emptiedDirs) -> deletes the files, then the directories they emptied

import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, realpathSync, rmSync, rmdirSync } from 'node:fs';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { blobId, committedPathContent, headBlobs, variants } from '../../hooks/lib/history-blobs.mjs';

const CHUNK = 100;
const BUFFER_BYTES = 256 * 1024 * 1024;
const FILE_MAX_BYTES = 256 * 1024 * 1024;
const REGULAR_FILE_MODE = /^100(?:644|755)$/;
const SHA = /^[0-9a-f]{40,64}$/;

const run = (root, args) => execFileSync('git', ['--literal-pathspecs', '-c', 'core.quotepath=false', ...args], {
  cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true, maxBuffer: BUFFER_BYTES,
});
const lines = (out) => out.split('\0').filter(Boolean);

export const treeRoot = (cwd) => realpathSync.native(execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd, encoding: 'utf8', windowsHide: true }).trim());

export function repoPaths(root, cwd, dirs) {
  return dirs.map((dir) => {
    const rel = relative(root, resolve(realpathSync.native(cwd), dir)).split(sep).join('/');
    if (isAbsolute(rel) || rel === '..' || rel.startsWith('../')) throw new Error(`${dir} is outside the repository ${root}`);
    if (!rel) throw new Error('the repository root cannot be restored whole: name the directories');
    if (rel === '.git' || rel.startsWith('.git/')) throw new Error(`${dir} is inside .git`);
    return rel;
  });
}

export function commitOf(root, rev) {
  if (rev.startsWith('-')) throw new Error(`${rev} is not a revision`);
  try {
    const id = run(root, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`]).trim();
    if (SHA.test(id)) return id;
  } catch { /* fall through to the message */ }
  throw new Error(`${rev} names no commit`);
}

export function treeBlobs(root, commit, paths) {
  const blobs = new Map();
  for (const entry of lines(run(root, ['ls-tree', '-r', '-z', commit, '--', ...paths]))) {
    const [meta, path] = entry.split('\t');
    const [mode, type, id] = meta.split(' ');
    if (type === 'blob' && REGULAR_FILE_MODE.test(mode)) blobs.set(path, id);
  }
  return blobs;
}

export const trackedFiles = (root, paths) => new Set(lines(run(root, ['ls-files', '-z', '--cached', '--', ...paths])));

export function diskFiles(root, paths) {
  const listed = [...trackedFiles(root, paths), ...lines(run(root, ['ls-files', '-z', '--others', '--exclude-standard', '--', ...paths]))];
  return new Set(listed.filter((rel) => {
    try { return !lstatSync(join(root, rel)).isDirectory(); } catch { return false; }
  }));
}

const bytesOf = (root, rel) => variants(root, rel, FILE_MAX_BYTES);

export const sameBytes = (root, path, id) => bytesOf(root, path).slice(0, 2).map(blobId).includes(id);

/** The paths of `rels` whose bytes on disk HEAD, or a commit reachable from HEAD, a branch, a tag or a remote, holds at that path. */
export function recoverablePaths(root, rels) {
  const head = headBlobs(root, rels);
  const atHead = rels.filter((rel) => sameBytes(root, rel, head.get(rel)));
  const rest = rels.filter((rel) => !atHead.includes(rel));
  return new Set([...atHead, ...committedPathContent(root, rest, (rel) => bytesOf(root, rel))]);
}

/** The paths of `paths` whose index entry holds a blob that neither HEAD nor a commit reachable from it holds at that path: staged work an index reset would discard. */
export function unrecoverableStaged(root, paths) {
  const head = headBlobs(root, paths);
  const staged = new Map();
  for (const entry of lines(run(root, ['ls-files', '-s', '-z', '--', ...paths]))) {
    const [meta, path] = entry.split('\t');
    const [, id, stage] = meta.split(' ');
    if (stage === '0' && id !== head.get(path)) staged.set(path, id);
  }
  const indexBytes = (rel) => {
    try { return [execFileSync('git', ['cat-file', 'blob', staged.get(rel)], { cwd: root, maxBuffer: BUFFER_BYTES, windowsHide: true })]; } catch { return []; }
  };
  const held = committedPathContent(root, [...staged.keys()], indexBytes);
  return [...staged.keys()].filter((path) => !held.has(path));
}

/** Removes from the index the entries of `paths`, which the commit HEAD names lacks (a raw `git checkout <rev> -- <dir>` staged them). */
export function dropStaged(root, paths, tracked) {
  const staged = paths.filter((path) => tracked.has(path));
  for (let i = 0; i < staged.length; i += CHUNK) run(root, ['restore', '--source=HEAD', '--staged', '--', ...staged.slice(i, i + CHUNK)]);
}

export function checkout(root, commit, files, { alsoIndex = false } = {}) {
  const index = alsoIndex ? ['--staged'] : [];
  for (let i = 0; i < files.length; i += CHUNK) run(root, ['restore', `--source=${commit}`, '--worktree', ...index, '--', ...files.slice(i, i + CHUNK)]);
}

export function removeFiles(root, files, emptiedDirs) {
  for (const file of files) rmSync(join(root, file), { force: true });
  for (const dir of emptiedDirs) {
    try { if (existsSync(join(root, dir))) rmdirSync(join(root, dir)); } catch { /* not empty: something else lives there */ }
  }
}
