// withdraw.mjs — take a QUEUED job out of the queue with a final result (KIT-T323): `--revises`
// withdraws its predecessor as `superseded`, `broker cancel <id>` as `cancelled`. A job the daemon is
// running is never touched.
//
// `withdrawJob(cfg, id, { status, message })` -> { ok, error? }

import { readInflight } from './preimage.mjs';
import { STATUS, listQueue, readResult, removeJob, writeResult } from './result.mjs';

export function withdrawJob(cfg, id, { status = STATUS.CANCELLED, message = 'cancelled' } = {}) {
  const running = readInflight(cfg);
  if (running && running.id === id) return { ok: false, error: `${id} is running; a running job is never cancelled` };
  const job = listQueue(cfg).find((j) => j.id === id);
  if (!job) {
    const done = readResult(cfg, id);
    return { ok: false, error: done ? `${id} already finished (${done.status})` : `${id} is not queued` };
  }
  writeResult(cfg, { id, revises: job.revises || null, revision: job.revision || 1, repo: job.repo, ticket: job.ticket || null, base: job.base || null, land: !!job.land, status, phase: 'queue', commands: [], gate: [], stale: [], foreign: [], landed: null, message });
  removeJob(cfg, id);
  return { ok: true };
}
