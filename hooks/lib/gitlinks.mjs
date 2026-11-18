// gitlinks.mjs — the submodule pointers of a superproject (KIT-T1363), read from git, never from .gitmodules alone.
//
//   gitlinkPaths(top)          -> repo-relative paths of every gitlink in the index (mode 160000)
//   treePin(top, rev, path)    -> the sha `rev`'s tree records for `path`, '' when it records none
//   stagedPin(top, path)       -> the sha the index records for `path`, '' when none
//   worktreePin(top, path)     -> the checked-out submodule's HEAD, '' when it is not checked out

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { git } from './exec.mjs';

const GITLINK_MODE = '160000';
const lines = (out) => String(out).split('\n').filter(Boolean);
const INDEX_SHA_FIELD = 1;
const TREE_SHA_FIELD = 2;

export function gitlinkPaths(top) {
  return lines(git(['-c', 'core.quotepath=off', 'ls-files', '-s'], top))
    .filter((l) => l.startsWith(`${GITLINK_MODE} `))
    .map((l) => l.slice(l.indexOf('\t') + 1));
}

export function treePin(top, rev, path) {
  const entry = lines(git(['ls-tree', rev, '--', path], top))[0] || '';
  return entry.startsWith(`${GITLINK_MODE} `) ? entry.split(/\s+/)[TREE_SHA_FIELD] : '';
}

export function stagedPin(top, path) {
  const entry = lines(git(['ls-files', '-s', '--', path], top))[0] || '';
  return entry.startsWith(`${GITLINK_MODE} `) ? entry.split(/\s+/)[INDEX_SHA_FIELD] : '';
}

export function worktreePin(top, path) {
  const dir = join(top, path);
  return existsSync(join(dir, '.git')) ? git(['rev-parse', 'HEAD'], dir).trim() : '';
}
