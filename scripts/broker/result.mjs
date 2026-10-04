// result.mjs — the job and result files that are the broker's whole wire protocol. Workers
// write JOBS into the queue dir; the broker writes RESULTS a worker's `wait` polls for.
//
// JOB   (target/broker/queue/<id>.json), written by submit.mjs:
//   { id, repo, base, ops, files: { path: blobSha }, commands: [ "cargo t -p foo", … ], land: bool,
//     ticket, title, revises, revision, submittedAt }
//   empty `commands` means the broker fills `verify_default`.
//
// RESULT (target/broker/results/<id>.json), written by the broker or by submit on a stale dry run:
//   { id, revises, revision, ticket, base, head, status: passed|failed|gate|stale|dirty|landed|conflict|superseded|cancelled,
//     phase, gate: [{ path, check, msg }], stale: [{ index, path, reason, excerpt, since }],
//     commands: [{ cmd, composed, exit, durationMs, log, logTail, errors, failedTests, foreign? }],
//     foreign: [{ test, reason }]  (failures that also occur without the patch; they do not fail the job),
//     diffStat, landed: { sha, superSha }|null, dirtyEntries, message, startedAt, finishedAt }

import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';

export const STATUS = { PASSED: 'passed', FAILED: 'failed', DIRTY: 'dirty', STALE: 'stale', GATE: 'gate', LANDED: 'landed', CONFLICT: 'conflict', SUPERSEDED: 'superseded', CANCELLED: 'cancelled' };

export function ensureDirs(cfg) {
  const p = brokerPaths(cfg);
  for (const d of [p.home, p.queue, p.results, p.logs]) mkdirSync(d, { recursive: true });
  return p;
}

export function newJobId() {
  return `j-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function writeJob(cfg, job) {
  const p = ensureDirs(cfg);
  const full = { id: job.id || newJobId(), submittedAt: new Date().toISOString(), ...job };
  full.id = job.id || full.id;
  writeFileSync(join(p.queue, `${full.id}.json`), JSON.stringify(full, null, 2));
  return full;
}

// The queue in submission order (id carries a base36 timestamp, so lexical sort is chronological).
export function listQueue(cfg) {
  const p = brokerPaths(cfg);
  if (!existsSync(p.queue)) return [];
  return readdirSync(p.queue)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      try {
        return JSON.parse(readFileSync(join(p.queue, f), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/** True while the job's file is still in the queue. */
export const queued = (cfg, id) => existsSync(join(brokerPaths(cfg).queue, `${id}.json`));

// A job leaves the queue only once its result is written — a crash mid-job leaves the job file
// in place, so an idempotent restart re-queues it by construction (queue.mjs relies on this).
export function removeJob(cfg, id) {
  const p = brokerPaths(cfg);
  const f = join(p.queue, `${id}.json`);
  if (existsSync(f)) rmSync(f);
}

export function writeResult(cfg, result) {
  const p = ensureDirs(cfg);
  const full = { finishedAt: new Date().toISOString(), ...result };
  writeFileSync(join(p.results, `${result.id}.json`), JSON.stringify(full, null, 2));
  return full;
}

export function readResult(cfg, id) {
  const p = brokerPaths(cfg);
  const f = join(p.results, `${id}.json`);
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
}

export function logPathFor(cfg, id, n) {
  return join(brokerPaths(cfg).logs, `${id}-${n}.log`);
}
