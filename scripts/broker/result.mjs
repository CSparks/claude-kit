// result.mjs — the job and result files that are the broker's whole wire protocol. Workers
// write JOBS into the queue dir; the broker writes RESULTS a worker's `wait` polls for.
//
// JOB   (target/broker/queue/<id>.json), written by submit.mjs:
//   { id, repo, branch, commands: [ "cargo test -p foo --lib", … ], land: bool,
//     ticket: "ST-T123", title: "…", worktree: "<abs path>", submittedAt: ISO }
//   `commands` may be omitted/empty — the broker fills the repo's `verify_default`.
//   `worktree` lets the broker free the branch on a green land (see queue.mjs teardown).
//
// RESULT (target/broker/results/<id>.json), written by the broker:
//   { id, repo, branch, land, ticket, status: passed|failed|conflict|dirty,
//     commands: [ { cmd, composed, exit, durationMs, logTail: [...], log } ],
//     conflicts: [...]|null, landed: { sha }|null, dirtyEntries: [...]|null,
//     message, startedAt, finishedAt }

import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';

export const STATUS = { PASSED: 'passed', FAILED: 'failed', CONFLICT: 'conflict', DIRTY: 'dirty' };

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
