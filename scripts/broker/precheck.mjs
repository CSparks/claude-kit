// precheck.mjs — a compile error never takes a queue slot (KIT-D115). Before submit queues a job, the patch is written into
// the broker's own PRECHECK tree and `affected.check` (a `cargo check` of every target) runs there, in a persistent target
// dir of its own, so it never waits on the daemon's cargo lock and never touches the live or the check tree. A rustc error
// returns the failed result and the job is not queued. Anything else lets the job queue as before: a precheck that is off,
// a patch with no operations, another precheck holding the tree, a timeout (its progress stays in the target dir for the
// next one), a cargo that fails without a rustc error.
//
//   precheckJob(cfg, job, repo, { run?, prepare? }) -> a failed-result object to write, or null when the job may queue

import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { prepareCheckTree } from './check-tree.mjs';
import { brokerPaths } from './config.mjs';
import { UNLOCATED, diagnose } from './diagnose.mjs';
import { STATUS } from './result.mjs';
import { runCancellable } from './run-cancellable.mjs';
import { applyPatch } from './tree-apply.mjs';

const KIND = 'precheck';
const STALE_LOCK_MS = 10 * 60 * 1000;
const MS_PER_S = 1000;

// One precheck at a time per repo: the tree holds one patch. A second caller queues without a precheck.
function takeLock(dir) {
  try {
    if (existsSync(dir) && Date.now() - statSync(dir).mtimeMs > STALE_LOCK_MS) rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir);
    return () => rmSync(dir, { recursive: true, force: true });
  } catch { return null; }
}

const failedResult = (job, fields) => ({
  id: job.id, revises: job.revises || null, revision: job.revision, ticket: job.ticket || null, repo: job.repo, base: job.base, head: job.base,
  ...(job.session ? { session: job.session } : {}), ...(job.agent ? { agent: job.agent } : {}),
  status: STATUS.FAILED, phase: KIND, gate: [], stale: [], landed: null, ...fields,
});

export function precheckJob(cfg, job, repo, { run = runCancellable, prepare = prepareCheckTree } = {}) {
  if (!cfg.precheck || !cfg.affected?.check || !repo || !(job.ops || []).length || job.measure) return null;
  const home = brokerPaths(cfg).home;
  mkdirSync(home, { recursive: true });
  const release = takeLock(join(home, `${KIND}-${repo.name}.lock`));
  if (!release) return null;
  try {
    const tree = prepare(cfg, repo, { kind: KIND });
    if (tree.error || !applyPatch(tree.cfg, repo, tree.cwd, job).ok) return null;
    const log = join(home, `${KIND}-${job.id}.log`);
    const deadline = Date.now() + cfg.precheckTimeoutMs;
    const opts = { cwd: tree.cwd, targetDir: join(home, `${KIND}-target`, repo.name), logPath: log, jobs: cfg.jobs, timeoutMs: cfg.precheckTimeoutMs };
    const r = run(cfg.affected.check, opts, { shouldCancel: () => Date.now() > deadline });
    if (r.exit === 0 || r.cancelled || r.timedOut) return null;
    const { errors } = diagnose(readFileSync(log, 'utf8'));
    if (!Object.keys(errors).some((file) => file !== UNLOCATED)) return null;
    return failedResult(job, {
      commands: [{ cmd: r.cmd, exit: r.exit, durationMs: r.durationMs, log, logTail: r.logTail, errors }],
      message: `compile error in the patch (${cfg.affected.check}, ${Math.round(r.durationMs / MS_PER_S)}s); the job never entered the queue`,
    });
  } finally { release(); }
}
