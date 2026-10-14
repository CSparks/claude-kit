// prepush.mjs — the repo's own pre-push gate, run by the daemon before `git push` (KIT-T482 item 3).
// A long gate inside `git push` outlives the connection git opened first, and the push dies with
// SIGPIPE (exit 141) after "gate green". With a repo's `pre_push: true` the daemon runs the hook
// itself against the landing commit, in the shared build cache; a gate that records its green run
// (rapid-game's rg-gate-green.json) then lets the real push through at once.
//
// `buildEnv(cfg)` → the environment for every broker build or hook: the shared CARGO_TARGET_DIR,
//   CARGO_BUILD_JOBS, and no inherited GIT_* variables.
// `runPrePush(cfg, cwd, remote, branch, logPath)` → { ok, exit, log }.

import { spawnSync } from 'node:child_process';
import { openSync, closeSync, writeFileSync, rmSync } from 'node:fs';
import { git, revParse } from './git.mjs';
import { tail } from './run.mjs';

const ZERO = '0'.repeat(40);

export function buildEnv(cfg) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
  return { ...env, CARGO_TARGET_DIR: cfg.targetDir, CARGO_BUILD_JOBS: String(cfg.jobs) };
}

export function runPrePush(cfg, cwd, remote, branch, logPath) {
  const local = revParse(cwd, 'HEAD');
  const remoteSha = revParse(cwd, `${remote}/${branch}`) || ZERO;
  const url = git(['remote', 'get-url', remote], cwd).out || remote;
  const stdin = `${logPath}.stdin`;
  writeFileSync(stdin, `refs/heads/${branch} ${local} refs/heads/${branch} ${remoteSha}\n`);
  const fd = openSync(logPath, 'w');
  let exit;
  try {
    const r = spawnSync('git', ['hook', 'run', '--ignore-missing', `--to-stdin=${stdin}`, 'pre-push', '--', remote, url], {
      cwd, env: buildEnv(cfg), stdio: ['ignore', fd, fd], windowsHide: true,
    });
    exit = r.status == null ? 1 : r.status;
  } finally {
    closeSync(fd);
    rmSync(stdin, { force: true });
  }
  return { ok: exit === 0, exit, log: tail(logPath) };
}
