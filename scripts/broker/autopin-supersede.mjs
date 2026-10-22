// autopin-supersede.mjs — a queued auto-pin that a newer one makes redundant is dropped (KIT-T618).
// Pinning the newer sha moves the gitlink past the older one, so with ten rapid-game landings queued
// only the last pin needs its run. The older job is withdrawn as `superseded` (withdraw.mjs); a job
// the daemon is running is never touched, and a newer pin that does not descend from the older sha
// (a diverged history) leaves both queued.
//
//   dropSuperseded(cfg) -> [{ id, by }] the queued auto-pins withdrawn

import { join } from 'node:path';
import { repoByName } from './config.mjs';
import { git } from './git.mjs';
import { STATUS, listQueue } from './result.mjs';
import { withdrawJob } from './withdraw.mjs';

const pinOf = (job) => (job.pins || [])[0];

function descends(cfg, newer, older) {
  const sub = repoByName(cfg, pinOf(newer).repo);
  if (!sub) return false;
  return git(['merge-base', '--is-ancestor', pinOf(older).sha, pinOf(newer).sha], join(cfg.root, sub.path)).code === 0;
}

export function dropSuperseded(cfg) {
  const pins = listQueue(cfg).filter((j) => j.autoPin && (j.pins || []).length === 1 && !(j.ops || []).length);
  const dropped = [];
  for (const older of pins) {
    const newer = pins.filter((n) => n.id !== older.id && n.repo === older.repo && pinOf(n).repo === pinOf(older).repo
      && Date.parse(n.submittedAt) >= Date.parse(older.submittedAt) && pinOf(n).sha !== pinOf(older).sha && descends(cfg, n, older))
      .sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt))[0];
    if (!newer) continue;
    const r = withdrawJob(cfg, older.id, { status: STATUS.SUPERSEDED, message: `superseded by auto-pin ${newer.id}: pinning ${pinOf(newer).sha.slice(0, 10)} covers ${pinOf(older).sha.slice(0, 10)}` });
    if (r.ok) dropped.push({ id: older.id, by: newer.id });
  }
  return dropped;
}
