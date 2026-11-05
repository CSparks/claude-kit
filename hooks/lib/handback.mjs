// handback.mjs — the reconciler for worker work left open when a worker ends (KIT-T822, KIT-D115, KIT-D132).
// Every end mode (hand-back, crash, usage limit, context end, killed session) leaves durable state: the roster row,
// the broker's submission ledger and kept job copies (scripts/broker/submissions.mjs), finished.log, finished.ack,
// and the ticket Notes. From that alone it names what is open per ended writer. Each item is a NOTICE for the
// maintainer: nothing here dispatches, reopens or resumes (KIT-D132); the step is what the maintainer's signed bill could take.
//
//   result-ready  a finished job nobody picked up         -> reopen the agent when its transcript is reachable from the asking
//                                                            session; else ack a landed result (the reconciler acks it itself
//                                                            once the sha is on main and in the ticket), else a fresh worker
//   resubmit      a job that left the queue with no result -> node resubmit.mjs <job> (its kept copy exists)
//   fresh-worker  a lost job with no kept copy, or a dead agent with no handoff -> a fresh worker briefed from the ticket and git
//   successor     a Handoff block on an open ticket        -> a successor citing the ticket
//   unrecoverable a lost job with no kept copy and no ticket -> nothing to rebuild from
//   queued        a successor the dispatch guard held behind an in-flight worker (handback-queued.mjs) -> held; 'dispatch-queued'
//                 once that worker ends, the held brief still waits for the bill
//
//   reconcileHandbacks(root, rows, { nowMs, sessionId, autoAck }) -> [{ kind, key, step, agent, scope, ticket, job, verdict, landed, purged, text }]
//   brokerDir(root)                           -> <root>/target/broker, where the broker state lives
//
// Cleared by: an ack (SendMessage to the agent, `ack.mjs`, `resubmit.mjs`), a later dispatch citing the ticket, the
// ticket reaching review/done, a handoff that owes nothing (Next says stop, or `ack.mjs --handoff <agent> --reason`).
// A worker owes only the tickets its task label names (successor.mjs dispatchedTickets). A SendMessage that resumed the
// worker and named the ticket (reopened.mjs) takes the handoff over; silence past SILENT_MS brings it back as 'reopened'. A job still queued or running is waiting, not a failure.

import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ownsWork } from '../dispatch-readonly.mjs';
import { ackJobs, readAcks, sameAgent } from '../../scripts/broker/finished-ack.mjs';
import { landedOnMain, resumable } from './handback-landed.mjs';
import { applyQueued } from './handback-queued.mjs';
import { SILENT_MS, reopenState } from './reopened.mjs';
import { readFinished } from '../../scripts/broker/finished-log.mjs';
import { readSubmissions, submittedJob } from '../../scripts/broker/submissions.mjs';
import { ticketNotes } from '../../scripts/broker/red-run.mjs';
import { ceilingFlag, hasHandoff } from './agent-context.mjs';
import { CLOSED, dispatchedTickets, handoffClosed, openTicketStatus, recent, retiredAt, succeeded } from './successor.mjs';

const ENDED = new Set(['done', 'error', 'killed', 'stale']);
const ABNORMAL = new Set(['error', 'killed', 'stale']);
const LOST_GRACE_MS = 2 * 60 * 1000;
const MS_PER_MIN = 60 * 1000;
const SHA_SHOWN = 8;
const RESUBMIT = fileURLToPath(new URL('../../scripts/broker/resubmit.mjs', import.meta.url));
const ACK = fileURLToPath(new URL('../../scripts/broker/ack.mjs', import.meta.url));
const LANDED = 'landed';
const AUTO_ACK = 'auto:landed-on-main';

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
    const lead = `RESULT READY: ${item.job} ${item.verdict}${landed}${ctx}${purged}; agent ${row.id} finished it`;
    const signed = 'If the maintainer signs it:';
    if (item.step === 'ack') return `${lead} and is not resumable here. ${signed} verify ${item.landed.slice(0, SHA_SHOWN)} is on main and recorded in ${item.ticket || 'the ticket'}, then node "${ACK}" ${item.job}`;
    if (item.step === 'fresh-worker') return `${lead} and is not resumable here. ${signed} a fresh worker citing ${item.ticket || 'the job'}, briefed from its Handoff`;
    return `${lead}. ${signed} SendMessage ${row.id} to finish from its Handoff (acks the job)`;
  }
  if (item.kind === 'job-lost') {
    if (item.step === 'resubmit') return `JOB LOST: ${item.job}${ctx} left the queue with no result (agent ${row.id} ended); a kept copy exists. If the maintainer signs it: node "${RESUBMIT}" ${item.job}`;
    if (item.step === 'fresh-worker') return `JOB LOST: ${item.job}${ctx}, no kept copy (agent ${row.id} ended). If the maintainer signs it: a fresh worker citing ${item.ticket}, briefed from the ticket Notes and git log --grep=${item.ticket}`;
    return `JOB LOST, UNRECOVERABLE: ${item.job} (agent ${row.id}) has no result, no kept copy and no ticket to rebuild from`;
  }
  if (item.kind === 'reopened') return `REOPENED, SILENT: ${item.ticket} (${row.id}) was resumed by SendMessage and has written nothing for ${SILENT_MS / MS_PER_MIN} min`;
  if (item.kind === 'successor') return `RETIRED WITH HANDOFF: ${item.ticket} (${row.id}) has open work and no dispatch has cited it. The ticket may be superseded or stale: the maintainer decides. If its Handoff shows nothing is owed: node "${ACK}" --handoff ${row.id} --reason "<why>"`;
  return `AGENT ${row.status.toUpperCase()}: ${row.id} left ${item.ticket} open with no Handoff. The ticket may be superseded or stale: the maintainer decides`;
}

// Reopen needs a transcript SendMessage can reach; without one, a landed result is acknowledged and anything else
// goes to a fresh worker.
const readyStep = (fin, canReopen) => {
  if (canReopen) return 'reopen';
  return fin.verdict === LANDED && fin.landed ? 'ack' : 'fresh-worker';
};

function jobItem(root, dir, rows, row, job, acks, nowMs, { sessionId, autoAck }) {
  const since = job.fin ? job.fin.ts : job.submittedAt;
  if (acks.has(job.id) || (job.ticket && (!openTicket(root, job.ticket) || succeeded(root, rows, row, job.ticket, since)))) return null;
  const base = { agent: row.id, scope: row.scope, ticket: job.ticket, job: job.id };
  if (job.fin) {
    const unread = ABNORMAL.has(row.status) || job.fin.ts > retiredAt(row);
    if (!unread) return null;
    if (job.fin.verdict === LANDED && autoAck && landedOnMain(root, job.ticket, job.fin.landed)) {
      ackJobs(dir, [job.id], AUTO_ACK);
      return null;
    }
    const step = readyStep(job.fin, resumable(row, sessionId) && !ceilingFlag(row));
    return { ...base, kind: 'result-ready', step, key: `result-ready:${job.id}`, verdict: job.fin.verdict, landed: job.fin.landed, purged: !inLane(dir, 'results', job.id) };
  }
  if (inLane(dir, 'queue', job.id) || inLane(dir, 'results', job.id)) return null;
  if (nowMs - Date.parse(job.submittedAt) < LOST_GRACE_MS) return null;
  const step = submittedJob(dir, job.id) ? 'resubmit' : job.ticket ? 'fresh-worker' : 'unrecoverable';
  return { ...base, kind: 'job-lost', step, key: `job-lost:${job.id}` };
}

function workItems(root, rows, row, nowMs) {
  const out = [];
  for (const ticket of dispatchedTickets(row)) {
    if (!openTicket(root, ticket) || succeeded(root, rows, row, ticket) || handoffClosed(root, ticket, row.id)) continue;
    const handoff = hasHandoff(ticketNotes(root, ticket), row.id);
    const reopened = handoff || ABNORMAL.has(row.status) ? reopenState(root, row, ticket, { nowMs, since: retiredAt(row) }) : null;
    if (reopened === 'active') continue;
    if (reopened === 'silent') out.push({ kind: 'reopened', step: 'reopened-silent', key: `reopened:${row.id}:${ticket}`, agent: row.id, scope: row.scope, ticket });
    else if (handoff) out.push({ kind: 'successor', step: 'successor', key: `successor:${row.id}:${ticket}`, agent: row.id, scope: row.scope, ticket });
    else if (ABNORMAL.has(row.status)) out.push({ kind: 'dead', step: 'fresh-worker', key: `dead:${row.id}:${ticket}`, agent: row.id, scope: row.scope, ticket });
  }
  return out;
}

export function reconcileHandbacks(root, rows, { nowMs = Date.now(), sessionId = '', autoAck = true } = {}) {
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
    let found = jobs.map((j) => jobItem(root, dir, rows, row, j, acks, nowMs, { sessionId, autoAck })).filter(Boolean);
    if (!found.length && !waiting) found = workItems(root, rows, row, nowMs);
    for (const item of found) items.push({ ...item, text: describe(item, row), retired: retiredAt(row) });
  }
  return applyQueued(root, rows, latestPerTicket(items));
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
