// handback.mjs — the reconciler for worker work left open when a worker ends (KIT-T822, KIT-D115, KIT-D130).
// Every end mode (hand-back, crash, usage limit, context end, killed session) leaves durable state: the roster row,
// the broker's submission ledger and kept job copies (scripts/broker/submissions.mjs), finished.log, finished.ack,
// and the ticket Notes. From that alone it names the next recovery step per ended writer:
//
//   result-ready  a finished job nobody picked up         -> reopen the agent (or a successor when it is past the ceiling)
//   resubmit      a job that left the queue with no result -> node resubmit.mjs <job> (its kept copy exists)
//   fresh-worker  a lost job with no kept copy, or a dead agent with no handoff -> brief a fresh worker from the ticket and git
//   successor     a Handoff block on an open ticket        -> dispatch a successor citing the ticket
//   unrecoverable a lost job with no kept copy and no ticket -> nothing to rebuild from; surfaced once
//
//   reconcileHandbacks(root, rows, { nowMs }) -> [{ kind, key, step, agent, scope, ticket, job, verdict, landed, purged, text }]
//   brokerDir(root)                           -> <root>/target/broker, where the broker state lives
//
// Cleared by: an ack (SendMessage to the agent, `ack.mjs`, `resubmit.mjs`), a later dispatch citing the ticket, the
// ticket reaching review/done. A job still queued or running is waiting, not a failure.

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownsWork } from '../dispatch-readonly.mjs';
import { readAcks, sameAgent } from '../../scripts/broker/finished-ack.mjs';
import { readFinished } from '../../scripts/broker/finished-log.mjs';
import { readSubmissions, submittedJob } from '../../scripts/broker/submissions.mjs';
import { ticketNotes } from '../../scripts/broker/red-run.mjs';
import { ceilingFlag, hasHandoff } from './agent-context.mjs';
import { CLOSED, openTicketStatus, recent, retiredAt, succeeded } from './successor.mjs';

const ENDED = new Set(['done', 'error', 'killed', 'stale']);
const ABNORMAL = new Set(['error', 'killed', 'stale']);
const LOST_GRACE_MS = 2 * 60 * 1000;
const SHA_SHOWN = 8;
const RESUBMIT = fileURLToPath(new URL('../../scripts/broker/resubmit.mjs', import.meta.url));

export const brokerDir = (root) => join(root, 'target', 'broker');

function lanes(dir) {
  const lanesDir = join(dir, 'lanes');
  return [dir, ...(existsSync(lanesDir) ? readdirSync(lanesDir).map((l) => join(lanesDir, l)) : [])];
}
const inLane = (dir, sub, job) => lanes(dir).some((d) => existsSync(join(d, sub, `${job}.json`)));

// A finished line with no agent (a job submitted before the broker tagged them) belongs to the latest work-owning
// row citing its ticket that started before the job finished.
function untaggedClaims(root, rows, finished) {
  const claims = new Map();
  for (const f of finished) {
    if (f.agent || !f.ticket) continue;
    const owners = rows.filter((r) => ownsWork(root, r) && (r.tickets || []).includes(f.ticket) && String(r.firstSeen || r.ts) <= f.ts);
    const owner = owners.sort((a, b) => String(b.firstSeen).localeCompare(String(a.firstSeen)))[0];
    if (owner) claims.set(owner.id, [...(claims.get(owner.id) || []), f]);
  }
  return claims;
}

function jobsOf(row, ledger, finished, claimed = []) {
  const jobs = new Map();
  for (const f of claimed) jobs.set(f.job, { id: f.job, ticket: f.ticket, fin: f });
  for (const s of ledger) if (sameAgent(s.agent, row.id)) jobs.set(s.id, { id: s.id, ticket: s.ticket, submittedAt: s.submittedAt });
  for (const f of finished) if (sameAgent(f.agent, row.id)) jobs.set(f.job, { ...jobs.get(f.job), id: f.job, ticket: jobs.get(f.job)?.ticket || f.ticket, fin: f });
  return [...jobs.values()];
}

const openTicket = (root, ticket) => {
  const status = openTicketStatus(root, ticket);
  return !!status && !CLOSED.has(status);
};

function describe(item, row) {
  const ctx = item.ticket ? ` for ${item.ticket}` : '';
  if (item.kind === 'result-ready') {
    const landed = item.landed ? ` (landed ${item.landed.slice(0, SHA_SHOWN)})` : '';
    const purged = item.purged ? ' [result file purged; finished.log holds the verdict]' : '';
    const how = ceilingFlag(row) ? `dispatch a fresh successor citing ${item.ticket || 'the job'}, briefed from the Handoff` : `SendMessage ${row.id} to finish from its Handoff (acks the job)`;
    return `RESULT READY: ${item.job} ${item.verdict}${landed}${ctx}, reopen ${row.id}${purged}: ${how}`;
  }
  if (item.kind === 'job-lost') {
    if (item.step === 'resubmit') return `JOB LOST: ${item.job}${ctx} left the queue with no result (agent ${row.id} ended); kept copy exists: node "${RESUBMIT}" ${item.job}`;
    if (item.step === 'fresh-worker') return `JOB LOST: ${item.job}${ctx}, no kept copy: dispatch a fresh worker citing ${item.ticket}, briefed from the ticket Notes and git log --grep=${item.ticket}`;
    return `JOB LOST, UNRECOVERABLE: ${item.job} (agent ${row.id}) has no result, no kept copy and no ticket to rebuild from`;
  }
  if (item.kind === 'successor') return `RETIRED WITH HANDOFF: ${item.ticket} (${row.id}) has open work and no dispatch has cited it: dispatch a successor briefed from the Handoff`;
  return `AGENT ${row.status.toUpperCase()}: ${row.id} left ${item.ticket} open with no Handoff: dispatch a fresh worker citing ${item.ticket}, briefed from the ticket Notes and git log --grep=${item.ticket}`;
}

function jobItem(root, dir, rows, row, job, acks, nowMs) {
  const since = job.fin ? job.fin.ts : job.submittedAt;
  if (acks.has(job.id) || (job.ticket && (!openTicket(root, job.ticket) || succeeded(root, rows, row, job.ticket, since)))) return null;
  const base = { agent: row.id, scope: row.scope, ticket: job.ticket, job: job.id };
  if (job.fin) {
    const unread = ABNORMAL.has(row.status) || job.fin.ts > retiredAt(row);
    if (!unread) return null;
    return { ...base, kind: 'result-ready', step: 'reopen', key: `result-ready:${job.id}`, verdict: job.fin.verdict, landed: job.fin.landed, purged: !inLane(dir, 'results', job.id) };
  }
  if (inLane(dir, 'queue', job.id) || inLane(dir, 'results', job.id)) return null;
  if (nowMs - Date.parse(job.submittedAt) < LOST_GRACE_MS) return null;
  const step = submittedJob(dir, job.id) ? 'resubmit' : job.ticket ? 'fresh-worker' : 'unrecoverable';
  return { ...base, kind: 'job-lost', step, key: `job-lost:${job.id}` };
}

function workItems(root, rows, row) {
  const out = [];
  for (const ticket of row.tickets || []) {
    if (!openTicket(root, ticket) || succeeded(root, rows, row, ticket)) continue;
    const handoff = hasHandoff(ticketNotes(root, ticket), row.id);
    if (handoff) out.push({ kind: 'successor', step: 'successor', key: `successor:${row.id}:${ticket}`, agent: row.id, scope: row.scope, ticket });
    else if (ABNORMAL.has(row.status)) out.push({ kind: 'dead', step: 'fresh-worker', key: `dead:${row.id}:${ticket}`, agent: row.id, scope: row.scope, ticket });
  }
  return out;
}

export function reconcileHandbacks(root, rows, { nowMs = Date.now() } = {}) {
  const dir = brokerDir(root);
  const finished = readFinished(dir);
  const acks = readAcks(dir);
  const ledger = readSubmissions(dir);
  const claims = untaggedClaims(root, rows, finished);
  const items = [];
  for (const row of rows) {
    if (!ENDED.has(row.status) || !recent(row, nowMs) || !ownsWork(root, row)) continue;
    const jobs = jobsOf(row, ledger, finished, claims.get(row.id));
    const waiting = jobs.some((j) => !j.fin && (inLane(dir, 'queue', j.id) || inLane(dir, 'results', j.id)));
    let found = jobs.map((j) => jobItem(root, dir, rows, row, j, acks, nowMs)).filter(Boolean);
    if (!found.length && !waiting) found = workItems(root, rows, row);
    for (const item of found) items.push({ ...item, text: describe(item, row), retired: retiredAt(row) });
  }
  return latestPerTicket(items);
}

// One open-work item per ticket and kind: a ticket's earlier retired agents are superseded by its latest.
function latestPerTicket(items) {
  const keep = new Map();
  for (const i of items) {
    if (!(i.kind === 'successor' || i.kind === 'dead')) { keep.set(i.key, i); continue; }
    const slot = `${i.kind}:${i.ticket}`;
    if (!keep.has(slot) || i.retired > keep.get(slot).retired) keep.set(slot, i);
  }
  return [...keep.values()];
}
