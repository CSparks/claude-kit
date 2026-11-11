// framework-pin/state.mjs — what a consumer's framework submodule looks like right now, read with git only.
// Every command runs with --no-optional-locks so no read refreshes the index. While a broker holds the tree the
// working tree and HEAD are not read: the state comes from the recorded gitlink and origin/main alone.
//
//   readPinState(root, subPath, { held }) -> {
//     gitlink, origin, gitlinkKnown, gitlinkOnOrigin, behind, ahead,
//     head, branch, trackedEdits[], untracked[], localCommits[]        (the last five empty when held)
//   }  origin is '' when the submodule has no origin/main ref

import { join } from 'node:path';
import { git, gitTry } from '../exec.mjs';
import { gitlinkOf } from './submodule.mjs';

const ORIGIN_MAIN = 'origin/main';
const lines = (text) => text.split('\n').map((l) => l.trimEnd()).filter(Boolean);
const count = (sub, range) => Number(git(['--no-optional-locks', '-C', sub, 'rev-list', '--count', range], undefined).trim()) || 0;

const DETACHED = '(detached)';
const FIELDS_BEFORE_PATH = { 1: 8, 2: 9, u: 10 };
const editedPath = (record) => record.split('\t')[0].split(' ').slice(FIELDS_BEFORE_PATH[record[0]]).join(' ');

// One porcelain-v2 status answers HEAD, branch, tracked edits and untracked files: `1`/`2`/`u` records are edits
// (rename records carry "path<TAB>origPath"), `?` records are untracked.
function workingTree(sub) {
  const g = (...args) => git(['--no-optional-locks', '-C', sub, ...args]);
  const rows = lines(g('status', '--porcelain=v2', '--branch', '--untracked-files=all'));
  const header = (key) => rows.find((r) => r.startsWith(`# ${key} `))?.slice(`# ${key} `.length) || '';
  const branch = header('branch.head');
  return {
    head: header('branch.oid'),
    branch: branch === DETACHED ? '' : branch,
    trackedEdits: rows.filter((r) => /^[12u] /.test(r)).map(editedPath),
    untracked: rows.filter((r) => r.startsWith('? ')).map((r) => r.slice(2)),
    localCommits: lines(g('log', '--oneline', 'HEAD', '--branches', '--not', ORIGIN_MAIN)),
  };
}

export function readPinState(root, subPath, { held = false } = {}) {
  const sub = join(root, subPath);
  const g = (...args) => git(['--no-optional-locks', '-C', sub, ...args]);
  const gitlink = gitlinkOf(root, subPath);
  const origin = g('rev-parse', '--verify', '-q', `${ORIGIN_MAIN}^{commit}`).trim();
  const gitlinkKnown = Boolean(gitlink) && gitTry(['--no-optional-locks', '-C', sub, 'cat-file', '-e', `${gitlink}^{commit}`]).ok;
  const comparable = gitlinkKnown && Boolean(origin);
  const state = {
    gitlink, origin, gitlinkKnown,
    gitlinkOnOrigin: comparable && gitTry(['--no-optional-locks', '-C', sub, 'merge-base', '--is-ancestor', gitlink, origin]).ok,
    behind: comparable ? count(sub, `${gitlink}..${origin}`) : 0,
    ahead: comparable ? count(sub, `${origin}..${gitlink}`) : 0,
    head: '', branch: '', trackedEdits: [], untracked: [], localCommits: [],
  };
  return held || !origin ? state : { ...state, ...workingTree(sub) };
}
