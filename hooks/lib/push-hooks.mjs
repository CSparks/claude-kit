// Whether the pre-push gate a repo tracks is wired, so a `git push` runs it (KIT-T1300). A repo carries its gate in the tracked
// hooks directory `.githooks/pre-push`, which git runs only once `core.hooksPath` points at it; a fresh clone or a submodule
// checkout has no such setting, and a push then goes out ungated.
//
//   pushHookStatus(dir) -> { status, hookDir?, top? }   judged by the repo `dir` belongs to, from its own config
//     status 'none'     no repository here, or no tracked `pre-push` in a conventional directory: nothing to wire
//     status 'wired'    a `pre-push` hook exists where git looks for it (core.hooksPath, else the git dir's hooks)
//     status 'unwired'  `.githooks/pre-push` is tracked at the repo root and git looks elsewhere
//   wireCommand(top, hookDir) -> the one command that wires it, `top` and `hookDir` shell-quoted
//   Throws when a git call fails (not "not a repository") or when a tracked top-level `<dir>/pre-push` has a directory name
//   that is no plain path: the caller refuses what it could not check and suggests no command.
//
// Only the conventional directories at the repo root are recognised (HOOK_DIRS), never a recursive match: a `pre-push` file in
// a subfolder, vendored content or a nested repository is not this repo's gate and is never offered as a hooks path. The hooks
// directory in a printed command is always one of HOOK_DIRS, and `safeHookDir` holds any other name to a plain relative path.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

const HOOK = 'pre-push';
export const HOOK_DIRS = Object.freeze(['.githooks']);
const SAFE_DIR = /^[A-Za-z0-9._/-]+$/;
const NOT_A_REPO = /not a git repository/i;
const UNSET = 1;
const SHOWN_NAME_CHARS = 40;
const TOP_LEVEL_HOOK_PATHSPEC = `:(glob)*/${HOOK}`;

export const safeHookDir = (dir) => SAFE_DIR.test(dir) && !isAbsolute(dir) && !dir.split('/').includes('..');

const quote = (text) => `'${String(text).replace(/'/g, "'\\''")}'`;

export function wireCommand(top, hookDir) {
  if (!safeHookDir(hookDir)) throw new Error('the hooks directory name is not a plain relative path');
  return `git -C ${quote(top.replace(/\\/g, '/'))} config core.hooksPath ${quote(hookDir)}`;
}

function runGit(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.error) throw new Error(`git could not be run in ${cwd}: ${r.error.message}`);
  return r;
}

const must = (args, cwd) => {
  const r = runGit(args, cwd);
  if (r.status !== 0) throw new Error(`git ${args[0]} failed in ${cwd}: ${String(r.stderr).trim().slice(0, 200)}`);
  return r.stdout;
};

const shown = (name) => JSON.stringify(String(name).replace(/[^\x20-\x7e]/g, '?').slice(0, SHOWN_NAME_CHARS));

export function pushHookStatus(dir) {
  const rootRun = runGit(['rev-parse', '--show-toplevel'], dir);
  if (rootRun.status !== 0) {
    if (NOT_A_REPO.test(rootRun.stderr)) return { status: 'none' };
    throw new Error(`git rev-parse failed in ${dir}: ${String(rootRun.stderr).trim().slice(0, 200)}`);
  }
  const top = rootRun.stdout.trim();
  const tracked = must(['ls-files', '-z', '--', TOP_LEVEL_HOOK_PATHSPEC], top).split('\0').filter(Boolean);
  const oddly = tracked.map((p) => p.slice(0, -`/${HOOK}`.length)).find((d) => !HOOK_DIRS.includes(d) && !safeHookDir(d));
  if (oddly !== undefined) throw new Error(`a tracked ${shown(`${oddly}/${HOOK}`)} sits in a directory whose name is no plain path, so no wiring command is offered`);
  const hookDir = HOOK_DIRS.find((d) => tracked.includes(`${d}/${HOOK}`));
  if (!hookDir) return { status: 'none', top };

  const configured = runGit(['config', '--get', 'core.hooksPath'], top);
  if (configured.status !== 0 && configured.status !== UNSET) throw new Error(`git config failed in ${top}: ${String(configured.stderr).trim().slice(0, 200)}`);
  const hooksPath = configured.status === 0 ? configured.stdout.trim() : '';
  const hooksDir = hooksPath ? (isAbsolute(hooksPath) ? hooksPath : resolve(top, hooksPath)) : resolve(top, must(['rev-parse', '--git-path', 'hooks'], top).trim());
  if (existsSync(resolve(hooksDir, HOOK))) return { status: 'wired', top };
  return { status: 'unwired', top, hookDir };
}
