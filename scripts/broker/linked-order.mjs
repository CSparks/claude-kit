// linked-order.mjs — a linked landing job waits for the auto-pin of its submodule instead of failing (KIT-D118).
// A linked job (a superproject patch that edits submodule paths and lands both halves) needs the submodule's local main to
// sit at the commit the superproject records. When another landing moved main (rapid-game f360e8a) and its auto-pin job is
// still queued, running the linked job first fails it in 0 s ("local main is not under the recorded …") and costs the
// agent a round trip. The queue holds such a job until the pin lands; a job with no pin queued yet is held for a bounded
// grace (the pin submit may still be starting), then runs and fails with the plain refusal.
//
//   linkedHold(cfg, job, pending, { now? }) -> { reason } while the job must wait, else null
//   PIN_GRACE_MS                            -> how long a job waits for a pin that is not queued

import { join } from 'node:path';
import { repoByName } from './config.mjs';
import { mainMovedPast, splitLinked } from './linked.mjs';

export const PIN_GRACE_MS = 2 * 60 * 1000;
const firstHeld = new Map();

const pinOf = (cfg, job, pending, subNames) => pending.find((j) => j.id !== job.id && j.autoPin && j.land && (j.pins || []).some((p) => subNames.has(p.repo)));

export function linkedHold(cfg, job, pending, opts = {}) {
  try {
    return holdFor(cfg, job, pending, opts);
  } catch {
    return null; // a malformed job is the job engine's to fail (contain.mjs), never the ordering's
  }
}

function holdFor(cfg, job, pending, { now = Date.now() }) {
  if (!job.land || (job.pins || []).length) return null;
  const repo = repoByName(cfg, job.repo);
  if (!repo || repo.submodule) return null;
  const { subs } = splitLinked(cfg, repo, (job.ops || []).map((o) => o.path));
  const moved = [...subs.keys()].filter((sub) => mainMovedPast(join(cfg.root, sub.path), sub));
  if (!moved.length) { firstHeld.delete(job.id); return null; }
  const pin = pinOf(cfg, job, pending, new Set(moved.map((s) => s.name)));
  if (pin) return { reason: `${job.id} waits for auto-pin ${pin.id} of ${moved.map((s) => s.name).join(', ')}` };
  if (!firstHeld.has(job.id)) firstHeld.set(job.id, now);
  if (now - firstHeld.get(job.id) > PIN_GRACE_MS) return null;
  return { reason: `${job.id} waits for the auto-pin of ${moved.map((s) => s.name).join(', ')} (none queued yet)` };
}
