// submissions.mjs — the write-ahead record of every submit (KIT-T822), so a worker that ends any way (hand-back, crash,
// usage limit, killed session) leaves a job -> agent -> ticket map and the job itself for a resubmit.
//   <target>/broker/submissions.jsonl     { id, agent, session, ticket, repo, submittedAt } per submit
//   <target>/broker/submitted/<id>.json   the job as queued; kept SUBMITTED_KEEP_DAYS, then pruned
//
//   recordSubmission(cfg, job)      -> writes both before the job joins the queue (best effort)
//   readSubmissions(brokerDir)      -> ledger rows, oldest first
//   submittedJob(brokerDir, id)     -> the kept job object, or null
//   resubmitJob(cfg, id)            -> queues a kept job again under a new id; returns the queued job or null

import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { newJobId, writeJob } from './result.mjs';

export const LEDGER = 'submissions.jsonl';
export const SUBMITTED_DIR = 'submitted';
const SUBMITTED_KEEP_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const LEDGER_TAIL = 2000;

const homeOf = (cfg) => join(cfg.targetDir, 'broker');

function pruneSubmitted(dir, nowMs) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (nowMs - statSync(p).mtimeMs > SUBMITTED_KEEP_DAYS * MS_PER_DAY) rmSync(p, { force: true });
  }
}

export function recordSubmission(cfg, job) {
  try {
    const home = homeOf(cfg);
    const dir = join(home, SUBMITTED_DIR);
    mkdirSync(dir, { recursive: true });
    const submittedAt = job.submittedAt || new Date().toISOString();
    writeFileSync(join(dir, `${job.id}.json`), JSON.stringify({ ...job, submittedAt }));
    const row = { id: job.id, agent: job.agent || null, session: job.session || null, ticket: job.ticket || null, repo: job.repo || null, submittedAt };
    appendFileSync(join(home, LEDGER), `${JSON.stringify(row)}\n`);
    pruneSubmitted(dir, Date.now());
  } catch { /* the record is a recovery aid, never a reason to refuse a submit */ }
}

export function readSubmissions(brokerDir) {
  try {
    const lines = readFileSync(join(brokerDir, LEDGER), 'utf8').split('\n').filter(Boolean).slice(-LEDGER_TAIL);
    return lines.flatMap((l) => { try { return [JSON.parse(l)]; } catch { return []; } });
  } catch { return []; }
}

export function submittedJob(brokerDir, id) {
  const p = join(brokerDir, SUBMITTED_DIR, `${id}.json`);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

export function resubmitJob(cfg, id) {
  const kept = submittedJob(homeOf(cfg), id);
  if (!kept) return null;
  const job = { ...kept, id: newJobId(), submittedAt: new Date().toISOString(), resubmitOf: id };
  recordSubmission(cfg, job);
  return writeJob(cfg, job);
}
