// resume.mjs — finish a landing a dead daemon left half done (KIT-T493, KIT-T482 item 4).
//   Past its commit (preimage.mjs markCommitted): a restart whose HEAD still holds the commit never
//   restores pre-images over it; it runs the rest of the landing: sync, the repo's pre-push gate,
//   push, pin.
//   A linked job past its submodule push (markLinked): the submodule commit stays; the consumer
//   files are put back to the patched bytes the journal recorded, then the superproject commit
//   (consumer paths + gitlink) is made, unless the dead daemon's git already made it, and pushed.
// A remote that moved meanwhile is not re-verified here: the commit is dropped back to the remote
// tip and the job fails asking for a resubmit (a linked one: with --pin <submodule>=<pushed sha>).
// A push that fails before any rebase undoes the commit and restores the superproject's pre-images.
//
// `resumeLanding(cfg, journal, { onResult })` → the results written, one per job.

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { repoByName } from './config.mjs';
import { catBlob, git, revParse } from './git.mjs';
import { landCommits, pushLanding } from './land.mjs';
import { phaseTracker } from './phase.mjs';
import { unpushedGitlink } from './pin.mjs';
import { discard, restore } from './preimage.mjs';
import { STATUS, removeJob, writeResult } from './result.mjs';

const NO_VERIFY = () => ({ ok: false });

// The superproject half of a linked job: commit (unless already made) and push.
function finishLinked(cfg, repo, journal, onPhase) {
  const l = journal.linked;
  for (const [path, blob] of Object.entries(l.blobs || {})) {
    const abs = join(journal.cwd, path);
    if (blob) { mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, catBlob(journal.cwd, blob)); } else rmSync(abs, { force: true });
  }
  const unpushed = unpushedGitlink(l.subs.map((s) => ({ ...s, remote: repoByName(cfg, s.name).remote, main: repoByName(cfg, s.name).main })));
  if (unpushed) return { ok: false, committed: false, error: unpushed };
  const paths = [...l.own, ...l.gitlinks];
  const head = revParse(journal.cwd, 'HEAD');
  const made = head !== l.preHead && l.subs.every((s) => git(['rev-parse', `HEAD:${s.path}`], journal.cwd).out === s.sha);
  if (made) return pushLanding(cfg, repo, journal.cwd, { jobs: [l.job], paths, preHead: l.preHead, verify: NO_VERIFY, onPhase });
  return landCommits(cfg, repo, journal.cwd, [{ job: l.job, paths, trailer: l.trailer }], { verify: NO_VERIFY, onPhase });
}

export function resumeLanding(cfg, journal, { onResult = () => {} } = {}) {
  const c = journal.committed;
  const l = !c && journal.linked;
  const repoName = c ? c.repo : l.repo;
  const jobs = c ? c.jobs : [l.job];
  const repo = repoByName(cfg, repoName);
  const ph = phaseTracker(cfg, journal.id);
  ph.enter('resume');
  const startedAt = new Date().toISOString();
  const onPhase = (p) => ph.enter(p);
  let land;
  if (!repo) land = { ok: false, committed: true, error: `unknown repo '${repoName}'; the local state stays as it is` };
  else if (c) land = pushLanding(cfg, repo, journal.cwd, { jobs: c.jobs, paths: c.paths, preHead: c.preHead, verify: NO_VERIFY, onPhase });
  else land = finishLinked(cfg, repo, journal, onPhase);
  if (land.committed) discard(cfg);
  else restore(cfg, journal);
  const subSha = l ? l.subs[l.subs.length - 1].sha : null;
  const why = c
    ? `the daemon stopped after commit ${String(c.sha).slice(0, 10)}; a restarted daemon finished the landing`
    : `the daemon stopped after pushing ${l.subs.map((s) => `${s.name} ${s.sha.slice(0, 10)}`).join(', ')}; a restarted daemon landed the ${repoName} half`;
  const resubmit = l ? `; resubmit the ${repoName} half with ${l.subs.map((s) => `--pin ${s.name}=${s.sha}`).join(' ')}` : '; resubmit';
  return jobs.map((job, i) => {
    const r = writeResult(cfg, {
      id: job.id, repo: repoName, ticket: job.ticket || null, title: job.title || null, land: true, base: null, startedAt,
      gate: [], stale: [], commands: [], foreign: [], diffStat: '', resumed: { journal: journal.id, sha: c ? c.sha : subSha },
      timings: ph.snapshot(),
      ...(land.ok
        ? { status: STATUS.LANDED, phase: 'land', landed: { sha: land.shas[i], superSha: land.superSha, ...(subSha ? { subSha } : {}) }, message: why }
        : { status: land.conflict ? STATUS.CONFLICT : STATUS.FAILED, phase: 'land', landed: null, message: `${why}, and it did not land: ${land.error}${resubmit}` }),
    });
    removeJob(cfg, job.id);
    onResult(r);
    return r;
  });
}
