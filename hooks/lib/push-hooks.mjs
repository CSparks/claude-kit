// Whether the pre-push gate a repo tracks is wired, so a `git push` runs it (KIT-T1300). A repo can carry its gate in a
// tracked hooks directory (`.githooks/pre-push`) that git runs only once `core.hooksPath` points at it; a fresh clone or a
// submodule checkout has no such setting, and a push then goes out ungated.
//
//   pushHookStatus(dir) -> { status, hookDir?, top? }   judged by the repo `dir` belongs to, from its own config
//     status 'none'     no repository here, or no tracked `pre-push` file: nothing to wire
//     status 'wired'    a `pre-push` hook exists where git looks for it (core.hooksPath, else the git dir's hooks)
//     status 'unwired'  a tracked `pre-push` exists in `hookDir` (repo-relative, posix) and git looks elsewhere
//   wireCommand(top, hookDir) -> the one command that wires it
//   Throws when a git call fails (not "not a repository"): the caller refuses what it could not check.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, isAbsolute, resolve } from 'node:path';

const HOOK = 'pre-push';
const GLOB = `:(glob)**/${HOOK}`;
const NOT_A_REPO = /not a git repository/i;
const UNSET = 1;

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

export const wireCommand = (top, hookDir) => `git -C "${top.replace(/\\/g, '/')}" config core.hooksPath ${hookDir}`;

export function pushHookStatus(dir) {
  const rootRun = runGit(['rev-parse', '--show-toplevel'], dir);
  if (rootRun.status !== 0) {
    if (NOT_A_REPO.test(rootRun.stderr)) return { status: 'none' };
    throw new Error(`git rev-parse failed in ${dir}: ${String(rootRun.stderr).trim().slice(0, 200)}`);
  }
  const top = rootRun.stdout.trim();
  const tracked = must(['ls-files', '-z', '--', GLOB], top).split('\0').filter(Boolean);
  if (!tracked.length) return { status: 'none', top };

  const configured = runGit(['config', '--get', 'core.hooksPath'], top);
  if (configured.status !== 0 && configured.status !== UNSET) throw new Error(`git config failed in ${top}: ${String(configured.stderr).trim().slice(0, 200)}`);
  const hooksPath = configured.status === 0 ? configured.stdout.trim() : '';
  const hooksDir = hooksPath ? (isAbsolute(hooksPath) ? hooksPath : resolve(top, hooksPath)) : resolve(top, must(['rev-parse', '--git-path', 'hooks'], top).trim());
  if (existsSync(resolve(hooksDir, HOOK))) return { status: 'wired', top };
  return { status: 'unwired', top, hookDir: dirname(tracked[0]).replace(/\\/g, '/') };
}
