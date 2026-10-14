// resume.mjs — finish a landing a dead daemon left past its commit (KIT-T493). The journal was
// re-based at the commit (preimage.mjs markCommitted), so a restart whose HEAD still holds the
// commit never restores pre-images over it; it runs the rest of the landing instead: sync,
// the repo's pre-push gate, push, pin. A remote that moved meanwhile is not re-verified here:
// the commit is dropped back to the remote tip and the job fails asking for a resubmit. A push
// that fails before any rebase undoes the commit and restores the pre-images.
//
// `resumeLanding(cfg, journal, { onResult })` → the results written, one per committed job.

import { repoByName } from './config.mjs';
import { pushLanding } from './land.mjs';
import { phaseTracker } from './phase.mjs';
import { discard, restore } from './preimage.mjs';
import { STATUS, removeJob, writeResult } from './result.mjs';

export function resumeLanding(cfg, journal, { onResult = () => {} } = {}) {
  const c = journal.committed;
  const repo = repoByName(cfg, c.repo);
  const ph = phaseTracker(cfg, journal.id);
  ph.enter('resume');
  const startedAt = new Date().toISOString();
  const land = repo
    ? pushLanding(cfg, repo, journal.cwd, { jobs: c.jobs, paths: c.paths, preHead: c.preHead, verify: () => ({ ok: false }), onPhase: (p) => ph.enter(p) })
    : { ok: false, committed: true, error: `unknown repo '${c.repo}'; commit ${c.sha} stays local` };
  if (land.committed) discard(cfg);
  else restore(cfg, journal);
  const why = `the daemon stopped after commit ${String(c.sha).slice(0, 10)}; a restarted daemon finished the landing`;
  return c.jobs.map((job, i) => {
    const r = writeResult(cfg, {
      id: job.id, repo: c.repo, ticket: job.ticket || null, title: job.title || null, land: true, base: null, startedAt,
      gate: [], stale: [], commands: [], foreign: [], diffStat: '', resumed: { journal: journal.id, sha: c.sha },
      timings: ph.snapshot(),
      ...(land.ok
        ? { status: STATUS.LANDED, phase: 'land', landed: { sha: land.shas[i], superSha: land.superSha }, message: why }
        : { status: land.conflict ? STATUS.CONFLICT : STATUS.FAILED, phase: 'land', landed: null, message: `${why}, and it did not land: ${land.error}; resubmit` }),
    });
    removeJob(cfg, job.id);
    onResult(r);
    return r;
  });
}
