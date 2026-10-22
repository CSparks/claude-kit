// prepush.mjs — the repo's own pre-push gate, run by the daemon before `git push` (KIT-T482 item 3).
// A long gate inside `git push` outlives the connection git opened first, and the push dies with
// SIGPIPE (exit 141) after "gate green". With a repo's `pre_push: true` the daemon runs the hook
// itself against the landing commit, in the shared build cache; a gate that records its green run
// (rapid-game's rg-gate-green.json) then lets the real push through at once.
//
// `buildEnv(cfg)` → the environment for every broker build or hook: the shared CARGO_TARGET_DIR,
//   CARGO_BUILD_JOBS, NEXTEST_TEST_THREADS when `parallelism.test_threads` is set, and no inherited GIT_* variables.
// `runPrePush(cfg, cwd, remote, branch, logPath)` → { ok, exit, log }. The gate runs beside a beating
//   daemon (run-pulsing.mjs), so a 17-minute gate never reads as a stall (KIT-T493).
//   Every Cargo.lock is put back as found afterwards: the gate's cargo may rewrite one, and the
//   repo's own hook refuses a push from a dirty lock (KIT-T519).

import { writeFileSync, rmSync } from 'node:fs';
import { git, revParse } from './git.mjs';
import { holdLocks } from './locks.mjs';
import { runPulsing } from './run-pulsing.mjs';
import { tail } from './run.mjs';
import { acquireBuildSlot } from './build-slot.mjs';

const ZERO = '0'.repeat(40);

export function buildEnv(cfg) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_')));
  return { ...env, PYTHONDONTWRITEBYTECODE: '1', CARGO_TARGET_DIR: cfg.targetDir, CARGO_BUILD_JOBS: String(cfg.jobs), ...(cfg.testThreads ? { NEXTEST_TEST_THREADS: String(cfg.testThreads) } : {}) };
}

export function runPrePush(cfg, cwd, remote, branch, logPath) {
  const local = revParse(cwd, 'HEAD');
  const remoteSha = revParse(cwd, `${remote}/${branch}`) || ZERO;
  const url = git(['remote', 'get-url', remote], cwd).out || remote;
  const stdin = `${logPath}.stdin`;
  writeFileSync(stdin, `refs/heads/${branch} ${local} refs/heads/${branch} ${remoteSha}\n`);
  let exit;
  const slot = acquireBuildSlot('pre-push gate', { jobs: cfg.jobs, label: `pre-push gate ${cwd}`, force: true });
  try {
    exit = holdLocks(cwd, () => runPulsing(['git', 'hook', 'run', '--ignore-missing', `--to-stdin=${stdin}`, 'pre-push', '--', remote, url], { cwd, env: buildEnv(cfg), logPath }).status);
  } finally {
    slot.release();
    rmSync(stdin, { force: true });
  }
  return { ok: exit === 0, exit, log: tail(logPath) };
}
