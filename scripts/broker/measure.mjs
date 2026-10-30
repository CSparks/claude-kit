// measure.mjs — the measurement lane (KIT-D115). A job submitted with `--measure` prints numbers and is red by design:
// it must never block or delay a landing, so it is not in the landing queue (result.mjs listQueue) and runs only as IDLE
// work, in the check tree, and is abandoned the moment any lane has a landing job queued or running. An abandoned job stays
// queued and starts over on the next idle moment. Its result has status `measured` with every command's exit and log tail;
// the exits are not a verdict, so it never counts as a red run and never makes a landing wait. A command that did not BUILD
// (cargo's `could not compile`) produced no numbers: the job ends `compile-error` with the compiler error in its message.
//
//   runMeasurements(cfg, { run?, prepare?, busy? }) -> { ran: [job ids], cancelled: boolean }

import { readFileSync } from 'node:fs';
import { repoByName } from './config.mjs';
import { stopRequested } from './control.mjs';
import { prepareCheckTree } from './check-tree.mjs';
import { diagnose } from './diagnose.mjs';
import { jobCommands } from './job-commands.mjs';
import { laneBusy } from './lane-busy.mjs';
import { STATUS, listMeasure, logPathFor, removeJob, writeResult } from './result.mjs';
import { runCancellable } from './run-cancellable.mjs';
import { tail } from './run.mjs';
import { applyPatch } from './tree-apply.mjs';

const LOG_TAIL_LINES = 200;
const COULD_NOT_COMPILE = /^error: could not compile /m;
const MAX_ERRORS_SHOWN = 3;
const ERROR_HEAD = /^error(\[E\d+\])?: /;

// The first compiler errors of the command that failed to build, so the result names the cause without opening the log.
function buildMessage(c) {
  const heads = Object.entries(c.errors).flatMap(([file, blocks]) => blocks.map((b) => `${b.split('\n')[0]} (${file})`)).filter((l) => ERROR_HEAD.test(l));
  return `measurement did not build (${c.cmd}): ${heads.slice(0, MAX_ERRORS_SHOWN).join('; ') || 'see the log'}`;
}

function measure(cfg, job, repo, { run, prepare, busy }) {
  const tree = prepare(cfg, repo);
  if (tree.error) return { skipped: true };
  const base = { id: job.id, repo: job.repo, ticket: job.ticket || null, revises: job.revises || null, revision: job.revision, base: job.base, head: job.base, gate: [], stale: [], landed: null };
  if ((job.ops || []).length) {
    const applied = applyPatch(tree.cfg, repo, tree.cwd, job);
    if (!applied.ok) return { result: { ...base, status: STATUS.STALE, phase: 'measure', stale: applied.stale, commands: [] } };
  }
  const commands = [];
  let unbuilt = null;
  const cancel = () => !!busy(cfg) || stopRequested(cfg);
  for (const [i, cmd] of jobCommands(cfg, job).entries()) {
    const log = logPathFor(cfg, job.id, i + 1);
    const r = run(cmd, { cwd: tree.cwd, targetDir: cfg.targetDir, logPath: log, jobs: cfg.jobs, testThreads: cfg.testThreads }, { shouldCancel: cancel });
    if (r.cancelled) return { cancelled: true };
    const text = readFileSync(log, 'utf8');
    commands.push({ cmd: r.cmd, exit: r.exit, durationMs: r.durationMs, log, logTail: tail(log, LOG_TAIL_LINES), ...diagnose(text) });
    if (!unbuilt && r.exit !== 0 && COULD_NOT_COMPILE.test(text)) unbuilt = commands.at(-1);
  }
  if (unbuilt) return { result: { ...base, status: STATUS.BUILD_ERROR, phase: 'measure', commands, message: buildMessage(unbuilt) } };
  return { result: { ...base, status: STATUS.MEASURED, phase: 'measure', commands, message: 'measurement: the exits are not a verdict; read the log tails' } };
}

export function runMeasurements(cfg, deps = {}) {
  const env = { run: runCancellable, prepare: prepareCheckTree, busy: laneBusy, ...deps };
  const ran = [];
  for (const job of listMeasure(cfg)) {
    if (env.busy(cfg) || stopRequested(cfg)) return { ran, cancelled: false };
    const repo = repoByName(cfg, job.repo);
    if (!repo) continue;
    const out = measure(cfg, job, repo, env);
    if (out.cancelled) return { ran, cancelled: true };
    if (out.skipped) continue;
    writeResult(cfg, out.result);
    removeJob(cfg, job.id);
    ran.push(job.id);
  }
  return { ran, cancelled: false };
}
