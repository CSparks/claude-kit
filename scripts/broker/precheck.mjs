// precheck.mjs — a compile error never takes a queue slot (KIT-D115). Before submit queues a job, the patch is written into
// the broker's own PRECHECK tree and `affected.check` (a `cargo check` of every target) runs there, in a persistent target
// dir of its own, so it never waits on the daemon's cargo lock and never touches the live or the check tree. A rustc error
// returns the failed result and the job is not queued. Anything else lets the job queue as before: a precheck that is off,
// a patch with no operations, another precheck holding the tree, a timeout (its progress stays in the target dir for the
// next one), a cargo that fails without a rustc error.
// A script the patch touches (.mjs/.cjs/.js) must pass `node --check` (syntax-check.mjs); that check needs no cargo and runs
// whenever the precheck is on. The cargo check of a COLD target dir (nothing has ever finished there) is a whole-workspace
// build: it runs only while every lane is idle, so it never competes with a landing job for the machine (a cold precheck
// beside a running job slowed it past the 10-minute kill). Once one run has finished, the target dir is warm and the
// precheck runs beside jobs again.
//
//   precheckJob(cfg, job, repo, { run?, prepare?, busy? }) -> a failed-result object to write, or null when the job may queue

import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { prepareCheckTree } from './check-tree.mjs';
import { brokerPaths } from './config.mjs';
import { UNLOCATED, diagnose } from './diagnose.mjs';
import { laneBusy } from './lane-busy.mjs';
import { STATUS } from './result.mjs';
import { runCancellable } from './run-cancellable.mjs';
import { scriptSyntaxFailures } from './syntax-check.mjs';
import { applyPatch } from './tree-apply.mjs';

const KIND = 'precheck';
const DOC_ONLY = /\.md$/i;
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

const syntaxResult = (job, failures) => failedResult(job, {
  commands: failures.map((f) => ({ cmd: f.cmd, exit: f.exit, durationMs: 0, logTail: f.message.split('\n'), errors: { [f.file]: [f.message] } })),
  message: `syntax error in ${failures.map((f) => f.file).join(', ')} (node --check); the job never entered the queue`,
});

export function precheckJob(cfg, job, repo, { run = runCancellable, prepare = prepareCheckTree, busy = laneBusy } = {}) {
  if (!cfg.precheck || !repo || !(job.ops || []).length || job.measure) return null;
  const home = brokerPaths(cfg).home;
  mkdirSync(home, { recursive: true });
  const release = takeLock(join(home, `${KIND}-${repo.name}.lock`));
  if (!release) return null;
  try {
    const tree = prepare(cfg, repo, { kind: KIND });
    if (tree.error) return null;
    const applied = applyPatch(tree.cfg, repo, tree.cwd, job);
    if (!applied.ok) return null;
    const broken = scriptSyntaxFailures(tree.cwd, applied.files);
    if (broken.length) return syntaxResult(job, broken);
    if (!cfg.affected?.check || [...applied.files.keys()].every((file) => DOC_ONLY.test(file))) return null;
    const warm = join(home, `${KIND}-${repo.name}.warm`);
    if (!existsSync(warm) && busy(cfg)) return null;
    return cargoCheck(cfg, job, repo, home, tree, warm, run);
  } finally { release(); }
}

function cargoCheck(cfg, job, repo, home, tree, warm, run) {
  const log = join(home, `${KIND}-${job.id}.log`);
  const deadline = Date.now() + cfg.precheckTimeoutMs;
  const opts = { cwd: tree.cwd, targetDir: join(home, `${KIND}-target`, repo.name), logPath: log, jobs: cfg.jobs, timeoutMs: cfg.precheckTimeoutMs };
  const r = run(cfg.affected.check, opts, { shouldCancel: () => Date.now() > deadline });
  if (r.cancelled || r.timedOut) return null;
  if (r.exit === 0) { writeFileSync(warm, new Date().toISOString()); return null; }
  const { errors } = diagnose(readFileSync(log, 'utf8'));
  if (!Object.keys(errors).some((file) => file !== UNLOCATED)) return null;
  writeFileSync(warm, new Date().toISOString());
  return failedResult(job, {
    commands: [{ cmd: r.cmd, exit: r.exit, durationMs: r.durationMs, log, logTail: r.logTail, errors }],
    message: `compile error in the patch (${cfg.affected.check}, ${Math.round(r.durationMs / MS_PER_S)}s); the job never entered the queue`,
  });
}
