// precheck.mjs — a compile error never takes a queue slot (KIT-D115). Before submit queues a job, the patch is written into
// the broker's own PRECHECK tree and `affected.check` (a `cargo check` of every target) runs there, in a persistent target
// dir of its own, so it never waits on the daemon's cargo lock and never touches the live or the check tree. A rustc error
// returns the failed result and the job is not queued. Anything else lets the job queue as before: a precheck that is off,
// a patch with no operations, another precheck still holding the tree after a wait of one timeout, a timeout (its progress stays in the target dir for the
// next one), a cargo that fails without a rustc error, a crash inside the precheck itself.
// A script the patch touches (.mjs/.cjs/.js) must pass `node --check` (syntax-check.mjs); that check needs no cargo and runs
// whenever the precheck is on. The cargo check of a COLD target dir (nothing has ever finished there) is a whole-workspace
// build: it runs only while every lane is idle, so it never competes with a landing job for the machine (a cold precheck
// beside a running job slowed it past the 10-minute kill). A target dir the precheck created is cold (marker
// `precheck-<repo>.cold`) until one run finishes there; an older dir is warm.
// The check runs in two stages inside one deadline: the packages, libraries and test binaries the job's own cargo commands
// build (precheck-scope.mjs), then the whole workspace. A timeout in the second stage keeps the first stage's verdict, and a
// rustc error already in the log of a run cut off at the deadline rejects the job.
//
//   precheckJob(cfg, job, repo, { run?, prepare?, busy?, pause? }) -> a failed-result object to write, or null when the job may queue

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { prepareCheckTree } from './check-tree.mjs';
import { brokerPaths } from './config.mjs';
import { UNLOCATED, diagnose } from './diagnose.mjs';
import { jobCommands } from './job-commands.mjs';
import { laneBusy } from './lane-busy.mjs';
import { narrowCheck } from './precheck-scope.mjs';
import { STATUS } from './result.mjs';
import { runCancellable } from './run-cancellable.mjs';
import { scriptSyntaxFailures } from './syntax-check.mjs';
import { applyPatch } from './tree-apply.mjs';

const KIND = 'precheck';
const DOC_ONLY = /\.md$/i;
const STALE_LOCK_MS = 10 * 60 * 1000;
const MS_PER_S = 1000;

const LOCK_POLL_MS = 1000;
const sleepMs = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// One precheck at a time per repo: the tree holds one patch. A second caller waits for the holder (which ends inside its own
// deadline) up to `waitMs`, then queues without a precheck.
function takeLock(dir, waitMs, pause) {
  const giveUp = Date.now() + waitMs;
  for (;;) {
    try {
      if (existsSync(dir) && Date.now() - statSync(dir).mtimeMs > STALE_LOCK_MS) rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir);
      return () => rmSync(dir, { recursive: true, force: true });
    } catch { /* held */ }
    if (Date.now() >= giveUp) return null;
    pause(LOCK_POLL_MS);
  }
}

const readLog = (log) => (existsSync(log) ? readFileSync(log, 'utf8') : '');

const failedResult = (job, fields) => ({
  id: job.id, revises: job.revises || null, revision: job.revision, ticket: job.ticket || null, repo: job.repo, base: job.base, head: job.base,
  ...(job.session ? { session: job.session } : {}), ...(job.agent ? { agent: job.agent } : {}),
  status: STATUS.FAILED, phase: KIND, gate: [], stale: [], landed: null, ...fields,
});

const syntaxResult = (job, failures) => failedResult(job, {
  commands: failures.map((f) => ({ cmd: f.cmd, exit: f.exit, durationMs: 0, logTail: f.message.split('\n'), errors: { [f.file]: [f.message] } })),
  message: `syntax error in ${failures.map((f) => f.file).join(', ')} (node --check); the job never entered the queue`,
});

// The precheck is advisory: a crash inside it (a missing log, an unreadable tree) is reported and the job queues without it.
export function precheckJob(cfg, job, repo, deps = {}) {
  try { return runPrecheck(cfg, job, repo, deps); } catch (e) {
    console.error(`submit: precheck skipped (${e.message}); the job queues without it`);
    return null;
  }
}

function runPrecheck(cfg, job, repo, { run = runCancellable, prepare = prepareCheckTree, busy = laneBusy, pause = sleepMs } = {}) {
  if (!cfg.precheck || !repo || !(job.ops || []).length) return null;
  const home = brokerPaths(cfg).home;
  mkdirSync(home, { recursive: true });
  const release = takeLock(join(home, `${KIND}-${repo.name}.lock`), cfg.precheckTimeoutMs, pause);
  if (!release) return null;
  try {
    const tree = prepare(cfg, repo, { kind: KIND });
    if (tree.error) return null;
    const applied = applyPatch(tree.cfg, repo, tree.cwd, job);
    if (!applied.ok) return null;
    const broken = scriptSyntaxFailures(tree.cwd, applied.files);
    if (broken.length) return syntaxResult(job, broken);
    if (!cfg.affected?.check || [...applied.files.keys()].every((file) => DOC_ONLY.test(file))) return null;
    const target = join(home, `${KIND}-target`, repo.name);
    const cold = join(home, `${KIND}-${repo.name}.cold`);
    if ((existsSync(cold) || !existsSync(target)) && busy(cfg)) return null;
    if (!existsSync(target)) writeFileSync(cold, new Date().toISOString());
    return cargoChecks(cfg, job, { home, tree, target, cold, run, submodule: !!repo.submodule });
  } finally { release(); }
}

// The job's own targets first (precheck-scope.mjs), then the whole workspace, inside one deadline. A rustc error in either
// rejects the job, even when the run was cut off at the deadline: cargo prints an error as it finds it.
function cargoChecks(cfg, job, { home, tree, target, cold, run, submodule }) {
  const deadline = Date.now() + cfg.precheckTimeoutMs;
  const check = cfg.affected.fullCheck || cfg.affected.check;
  const stages = [narrowCheck(check, jobCommands(cfg, job), { submodule }), submodule ? null : check].filter(Boolean);
  for (const [i, cmd] of stages.entries()) {
    const left = deadline - Date.now();
    if (left <= 0) return null;
    const log = join(home, `${KIND}-${job.id}${i ? '-full' : ''}.log`);
    const r = run(cmd, { cwd: tree.cwd, targetDir: target, logPath: log, jobs: cfg.jobs, timeoutMs: left }, { shouldCancel: () => Date.now() > deadline });
    const errors = r.exit === 0 ? {} : diagnose(readLog(log)).errors;
    if (Object.keys(errors).some((file) => file !== UNLOCATED)) {
      rmSync(cold, { force: true });
      return failedResult(job, {
        commands: [{ cmd: r.cmd, exit: r.exit, durationMs: r.durationMs, log, logTail: r.logTail, errors }],
        message: `compile error in the patch (${cmd}, ${Math.round(r.durationMs / MS_PER_S)}s); the job never entered the queue`,
      });
    }
    if (r.cancelled || r.timedOut || r.exit !== 0) return null;
  }
  rmSync(cold, { force: true });
  return null;
}
