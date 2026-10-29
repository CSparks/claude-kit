// batch-window.mjs — hold a lone trainable job for a short window so a second agent's submit can join its
// train (KIT-T683). Agents submit minutes apart, so the 2 s coalesce window rarely catches a peer: in
// dirt-empire 161 of 190 solo jobs started with nothing else queued.
//
// `batchHold(cfg, queue, windowMs, now)` -> { waitMs } | null
//   Holds only when the whole lane queue is ONE job a train could carry (train-form `trainable`), the job
//   is younger than `windowMs`, and at least two sessions have been active across the checkout's lanes in
//   the last ACTIVE_MS (a single agent cannot batch with itself, so a box with one agent never waits).
//   A second queued job, an expired window or a quiet box releases it at once.
//
// `activeSessions(cfg, now)` -> Set of session ids that submitted or finished a job within ACTIVE_MS, any lane.

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths, laneConfigs } from './config.mjs';
import { listQueue } from './result.mjs';
import { trainable } from './train-form.mjs';

export const ACTIVE_MS = 10 * 60 * 1000;
const RECENT_RESULTS = 40;

const readJson = (file) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; } };

export function activeSessions(cfg, now = Date.now()) {
  const sessions = new Set();
  for (const lane of laneConfigs(cfg)) {
    for (const job of listQueue(lane)) if (job.session) sessions.add(job.session);
    const dir = brokerPaths(lane).results;
    let files = [];
    try { files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort().slice(-RECENT_RESULTS); } catch { /* no results yet */ }
    for (const f of files) {
      const r = readJson(join(dir, f));
      if (r && r.session && now - Date.parse(r.finishedAt) < ACTIVE_MS) sessions.add(r.session);
    }
  }
  return sessions;
}

export function batchHold(cfg, queue, windowMs, now = Date.now()) {
  if (!(windowMs > 0) || !(cfg.batch > 1) || queue.length !== 1) return null;
  const [head] = queue;
  if (!trainable(cfg, head, head)) return null;
  const waitMs = windowMs - (now - Date.parse(head.submittedAt));
  if (!(waitMs > 0) || activeSessions(cfg, now).size < 2) return null;
  return { waitMs };
}
