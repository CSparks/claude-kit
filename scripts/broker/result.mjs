// result.mjs — the job and result files that are the broker's whole wire protocol. Workers
// write JOBS into the queue dir; the broker writes RESULTS a worker's `wait` polls for.
//
// JOB   (target/broker/queue/<id>.json), written by submit.mjs:
//   { id, repo, base, ops, files: { path: blobSha }, commands: [ "cargo t -p foo", … ], land: bool,
//     ticket, title, revises, revision, session, agent, measure, submittedAt }   (session: who submitted it; rr.mjs serves sessions in turn;
//     agent: the submitting subagent (agent.mjs); measure: a measurement job (measure.mjs), kept out of listQueue)
//   empty `commands` means the broker fills `verify_default`.
//
// RESULT (target/broker/results/<id>.json), written by the broker or by submit on a stale dry run:
//   { id, revises, revision, ticket, base, head, status: passed|failed|gate|stale|dirty|landed|conflict|superseded|cancelled,
//     phase, gate: [{ path, check, msg }], stale: [{ index, path, reason, excerpt, since }],
//     commands: [{ cmd, composed, exit, durationMs, log, logTail, errors, failedTests, foreign? }],
//     foreign: [{ test, reason }]  (failures that also occur without the patch; they do not fail the job),
//     diffStat, landed: { sha, superSha }|null, dirtyEntries, message, startedAt, finishedAt,
//     killed?: { pid, at, beatAgeS, phase }  (the watchdog killed the daemon running this job; stall.mjs),
//     resumed?: { journal, sha }  (a restarted daemon finished a landing past its commit; resume.mjs),
//     train?: { id, members, size, builds }, blame?: [reason], session?: the submitting session, agent?: the submitting subagent }

import { mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { recordRun } from './red-run.mjs';
import { recordFinished } from './finished-log.mjs';

export const STATUS = { PASSED: 'passed', FAILED: 'failed', DIRTY: 'dirty', STALE: 'stale', GATE: 'gate', LANDED: 'landed', CONFLICT: 'conflict', SUPERSEDED: 'superseded', CANCELLED: 'cancelled', MEASURED: 'measured' };

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

// The landing queue in submission order (id carries a base36 timestamp, so lexical sort is chronological).
// Measurement jobs (`measure`) are not in it: they run in the idle lane (measure.mjs) and never delay a landing.
export const listQueue = (cfg) => listJobs(cfg).filter((job) => !job.measure);
export const listMeasure = (cfg) => listJobs(cfg).filter((job) => job.measure);

function listJobs(cfg) {
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

/** True when `id` already has a final result (anything but a dirty hold): a queue file still there is a leftover. */
export const hasFinalResult = (cfg, id) => {
  const r = readResult(cfg, id);
  return !!r && r.status !== STATUS.DIRTY;
};

/** True while the job's file is still in the queue. */
export const queued = (cfg, id) => existsSync(join(brokerPaths(cfg).queue, `${id}.json`));

// A job leaves the queue only once its result is written — a crash mid-job leaves the job file
// in place, so an idempotent restart re-queues it by construction (queue.mjs relies on this).
export function removeJob(cfg, id) {
  const p = brokerPaths(cfg);
  const f = join(p.queue, `${id}.json`);
  if (existsSync(f)) rmSync(f);
}

// A watchdog kill of the daemon that was running this job (stall.mjs killed.json), taken once.
function takeKill(cfg, id) {
  const file = join(brokerPaths(cfg).home, 'killed.json');
  let kills;
  try { kills = JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
  const at = kills.findIndex((k) => (k.ids || []).includes(id));
  if (at < 0) return null;
  const kill = kills[at];
  kill.ids = kill.ids.filter((x) => x !== id);
  if (!kill.ids.length) kills.splice(at, 1);
  writeFileSync(file, JSON.stringify(kills, null, 2));
  const { ids, ...rest } = kill;
  return rest;
}

// A field (session, agent) of a job still in the queue dir, so its result can name its submitter.
function queuedField(queueDir, id, field) {
  try { return JSON.parse(readFileSync(join(queueDir, `${id}.json`), 'utf8'))[field] || null; } catch { return null; }
}

export function writeResult(cfg, result) {
  const p = ensureDirs(cfg);
  const killed = result.killed || takeKill(cfg, result.id);
  const session = result.session || queuedField(p.queue, result.id, 'session');
  const agent = result.agent || queuedField(p.queue, result.id, 'agent');
  const full = { finishedAt: new Date().toISOString(), ...result, ...(session ? { session } : {}), ...(agent ? { agent } : {}), ...(killed ? { killed } : {}) };
  writeFileSync(join(p.results, `${result.id}.json`), JSON.stringify(full, null, 2));
  recordRun(cfg, full);
  recordFinished(cfg, full);
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
