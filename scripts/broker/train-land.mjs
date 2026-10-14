// train-land.mjs — finish a green train group (KIT-T482 item 1): check-only members pass and
// their files go back to their pre-images first (they never ride a commit or a pre-push gate),
// then the landing members commit by their own paths in submit order and leave in ONE push.
// The first commit carries any Cargo.lock the build rewrote. After a rebase the landing
// members' commands re-run on the rebased tree before the push.
//
// `landGroup(cfg, repo, ctx)` → true when the commits stay (the tree matches HEAD), false when
// the caller restores the journal. ctx = { id, cwd, pool, journal, entries, foreign, own,
// ranFor, nextLog, finish, onPhase }.

import { changedLocks } from './git.mjs';
import { landCommits } from './land.mjs';
import { restorePaths } from './preimage.mjs';
import { STATUS } from './result.mjs';
import { gateTrailer } from './trailer.mjs';
import { trainCommands } from './train-commands.mjs';
import { reverifyOk, runTrainCommands } from './train-run.mjs';
import { filesOf } from './write-plan.mjs';

export function landGroup(cfg, repo, { id, cwd, pool, journal, entries, foreign, own, ranFor, nextLog, finish, onPhase }) {
  const ran = new Map(pool.map((m) => [m.job.id, ranFor(m)]));
  const checkers = pool.filter((m) => !m.job.land);
  const landers = pool.filter((m) => m.job.land);
  restorePaths(journal, checkers.flatMap(filesOf));
  for (const m of checkers) finish(m, { status: STATUS.PASSED, phase: 'run', ...ran.get(m.job.id) });
  if (!landers.length) return false;

  const locks = changedLocks(cwd);
  const train = pool.length > 1 ? { id, size: pool.length } : null;
  const commits = landers.map((m, i) => ({
    job: m.job,
    paths: [...new Set([...filesOf(m), ...(i === 0 ? locks : [])])],
    trailer: gateTrailer(m.job, entries, { selection: own(m).selection, train }),
  }));
  const verify = () => ({ ok: reverifyOk(runTrainCommands(cfg, { id, repo: repo.name, cwd, commands: trainCommands(cfg, cwd, landers).commands, nextLog, baseline: null }), foreign) });
  const land = landCommits(cfg, repo, cwd, commits, { verify, onPhase });
  landers.forEach((m, i) => {
    const fields = ran.get(m.job.id);
    if (land.conflict) finish(m, { status: STATUS.CONFLICT, phase: 'land', ...fields, conflict: land.conflict, message: land.error });
    else if (!land.ok) finish(m, { status: STATUS.FAILED, phase: 'land', ...fields, message: land.error });
    else finish(m, { status: STATUS.LANDED, phase: 'land', ...fields, landed: { sha: land.shas[i], superSha: land.superSha } });
  });
  return land.committed;
}
