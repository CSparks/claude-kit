// queue.mjs — the strictly-serial job engine. `processOnce` drains the queue one job at a time,
// in submission order; `processJob` runs the full protocol for one job. The queue pauses (stops
// draining, leaves the job queued) on a dirty build checkout — that is how a hand-driven writer
// and the broker share one checkout: the broker only ever runs on a clean tree.
//
// Per job: dirty-check → detached rebase onto main → run commands → (land && green) ff-merge +
// push (+ submodule re-pin) → switch back to main → write result. A job leaves the queue only
// after its result is written, so a crash mid-job re-queues it on the next start.

import { join } from 'node:path';
import { repoByName } from './config.mjs';
import { STATUS, listQueue, removeJob, writeResult, logPathFor } from './result.mjs';
import { runCommand } from './run.mjs';
import { repinSuperproject } from './submodule.mjs';
import {
  checkoutState, checkoutDetached, rebaseOnto, switchTo, mergeFfOnly, push, deleteBranch,
  removeWorktree, revParse,
} from './git.mjs';

// Drain the queue until it is empty or a dirty checkout pauses it. Returns a summary the daemon
// (or a test) can log. `onResult` is an optional per-job callback.
export function processOnce(cfg, { onResult } = {}) {
  const processed = [];
  for (const job of listQueue(cfg)) {
    const { result, pause } = processJob(cfg, job);
    if (onResult) onResult(result);
    if (pause) return { processed, paused: true, pausedOn: job.id, reason: 'dirty' };
    removeJob(cfg, job.id);
    processed.push(result);
  }
  return { processed, paused: false };
}

// Run one job to a written result. Returns { result, pause } — pause:true leaves the job queued.
export function processJob(cfg, job) {
  const startedAt = new Date().toISOString();
  const base = { id: job.id, repo: job.repo, branch: job.branch, land: !!job.land, ticket: job.ticket || null, startedAt };
  const repo = repoByName(cfg, job.repo);
  if (!repo) return { result: finalize(cfg, { ...base, status: STATUS.FAILED, commands: [], message: `unknown repo '${job.repo}'` }) };

  const opCwd = join(cfg.root, repo.path);

  const state = checkoutState(opCwd);
  if (!state.clean) {
    const result = finalize(cfg, { ...base, status: STATUS.DIRTY, commands: [], dirtyEntries: state.entries, message: `build checkout dirty (${opCwd}) — queue paused until clean` });
    return { result, pause: true };
  }

  const det = checkoutDetached(opCwd, job.branch);
  if (!det.ok) {
    return { result: finalize(cfg, { ...base, status: STATUS.FAILED, commands: [], message: `cannot check out '${job.branch}': ${det.err}` }) };
  }
  const reb = rebaseOnto(opCwd, repo.main);
  if (!reb.ok) {
    switchTo(opCwd, repo.main);
    return { result: finalize(cfg, { ...base, status: STATUS.CONFLICT, commands: [], conflicts: reb.conflicts, message: `rebase onto ${repo.main} conflicts` }) };
  }

  const commands = Array.isArray(job.commands) && job.commands.length ? job.commands : cfg.verifyDefault;
  const cmdResults = [];
  let status = STATUS.PASSED;
  for (let n = 0; n < commands.length; n++) {
    const r = runCommand(commands[n], { cwd: opCwd, targetDir: cfg.targetDir, logPath: logPathFor(cfg, job.id, n), jobs: cfg.jobs });
    cmdResults.push({ ...r, log: logPathFor(cfg, job.id, n) });
    if (r.exit !== 0) { status = STATUS.FAILED; break; }
  }

  let landed = null;
  let message = null;
  if (job.land && status === STATUS.PASSED) {
    const land = doLand(cfg, repo, job, opCwd, reb.tip);
    if (land.ok) landed = { sha: land.sha, superSha: land.superSha || null };
    else { status = STATUS.FAILED; message = `land failed: ${land.error}`; }
  }

  switchTo(opCwd, repo.main); // always leave the checkout back on main
  return { result: finalize(cfg, { ...base, status, commands: cmdResults, landed, message }) };
}

// Fast-forward main to the verified rebased tip, push, tear down the worker's branch, and (for a
// submodule repo) re-pin the superproject. Any failure returns { ok:false, error }.
function doLand(cfg, repo, job, opCwd, tip) {
  const m = mergeFfOnly(opCwd, repo.main, tip);
  if (!m.ok) return { ok: false, error: `ff-merge into ${repo.main}: ${m.err}` };
  const p = push(opCwd, repo.remote, repo.main);
  if (!p.ok) return { ok: false, error: `push ${repo.remote} ${repo.main}: ${p.err}` };

  // Free the branch: remove the worker's worktree (it recorded one) so the branch can be deleted.
  if (job.worktree) removeWorktree(opCwd, job.worktree);
  deleteBranch(opCwd, job.branch);

  let superSha = null;
  if (repo.submodule) {
    const superRepo = cfg.repos.find((r) => !r.submodule && normalize(r.path) === normalize(repo.pinIn));
    const superRoot = join(cfg.root, repo.pinIn);
    const re = repinSuperproject({
      superRoot,
      subPath: repo.path,
      remote: superRepo ? superRepo.remote : repo.remote,
      main: superRepo ? superRepo.main : 'main',
      sha: m.sha,
      ticket: job.ticket || 'unknown',
      title: job.title || repo.path,
    });
    if (!re.ok) return { ok: false, error: re.error };
    superSha = revParse(superRoot, 'HEAD');
  }
  return { ok: true, sha: m.sha, superSha };
}

function finalize(cfg, result) {
  const full = { conflicts: null, landed: null, dirtyEntries: null, message: null, ...result };
  return writeResult(cfg, full);
}

function normalize(p) {
  return String(p).replace(/\\/g, '/').replace(/\/$/, '') || '.';
}
