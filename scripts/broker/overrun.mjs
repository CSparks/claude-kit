// overrun.mjs — a broker job over the 5-minute ceiling is a kit bug (KIT-D104). After each job the result's
// phase timings are summed; past CEILING_MS a `cap bug` goes to the claude-kit store naming the repo, the
// job, the dominant phase and its minutes, so a slow gate shows up as a ticket instead of a long wait.
// The text splits the run into minutes queued for the machine build slot and minutes the commands ran, so a
// queue-bound job reads differently from a compile-bound one without opening a log.
//
//   overrun(result)                       -> { totalMs, phase, phaseMs, rounds, queuedMs, commandMs } | null
//   reportOverrun(job, result, { fileBug }) -> true when a bug was filed (best effort, never throws)
//   reportTrainOverrun(results, { fileBug }) -> bugs filed: the members of one train share its timings, so each
//                                              train is reported once, naming every member's ticket

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export const CEILING_MS = 5 * 60 * 1000;
const CAP = join(import.meta.dirname, '..', 'cap.mjs');
const minutes = (ms) => (ms / 60000).toFixed(1);
const sum = (items, pick) => items.reduce((total, item) => total + (pick(item) || 0), 0);

// The phase with the most time summed over every timing of that name (a retried run phase counts once, whole).
function dominantPhase(timings) {
  const byPhase = new Map();
  for (const t of timings) {
    const seen = byPhase.get(t.phase) || { phase: t.phase, ms: 0, rounds: 0 };
    byPhase.set(t.phase, { ...seen, ms: seen.ms + (t.ms || 0), rounds: seen.rounds + 1 });
  }
  return [...byPhase.values()].reduce((best, p) => (p.ms > best.ms ? p : best));
}

export function overrun(result) {
  const timings = (result && result.timings) || [];
  const totalMs = sum(timings, (t) => t.ms);
  if (totalMs <= CEILING_MS) return null;
  const top = dominantPhase(timings);
  const commands = (result && result.commands) || [];
  return { totalMs, phase: top.phase, phaseMs: top.ms, rounds: top.rounds, queuedMs: sum(commands, (c) => c.slotWaitMs), commandMs: sum(commands, (c) => c.durationMs) };
}

export function fileKitBug({ text }) {
  const r = spawnSync(process.execPath, [CAP, 'bug', text, '--project', 'claude-kit'], { encoding: 'utf8', windowsHide: true });
  return r.status === 0;
}

export function reportOverrun(job, result, { fileBug = fileKitBug } = {}) {
  try {
    const o = overrun(result);
    if (!o) return false;
    const queued = o.queuedMs ? `, ${minutes(o.queuedMs)} min of it queued for the machine build slot` : '';
    const rounds = o.rounds > 1 ? ` over ${o.rounds} rounds` : '';
    const ran = o.commandMs ? `; commands ran ${minutes(o.commandMs)} min` : '';
    const text = `broker job over the 5-minute ceiling (KIT-D104): ${job.repo} ${o.phase} phase took ${minutes(o.phaseMs)} min${rounds} of ${minutes(o.totalMs)} min total${queued}${ran}; job ${job.id}${job.ticket ? ` (${job.ticket})` : ''}, status ${result.status}; split, scope or speed up that phase`;
    return fileBug({ text });
  } catch { return false; }
}

function trainJob(members) {
  const [first] = members;
  const tickets = [...new Set(members.map((m) => m.ticket).filter(Boolean))].join(' ');
  return { id: first.train ? first.train.id : first.id, repo: first.repo, ticket: tickets };
}

function trainResult(members) {
  const commands = [...new Map(members.flatMap((m) => m.commands || []).map((c) => [c.log || c.cmd, c])).values()];
  const status = [...new Set(members.map((m) => m.status))].join('/');
  return { ...members[0], commands, status };
}

export function reportTrainOverrun(results, opts = {}) {
  const trains = new Map();
  for (const r of results) trains.set(r.train ? r.train.id : r.id, [...(trains.get(r.train ? r.train.id : r.id) || []), r]);
  return [...trains.values()].filter((members) => reportOverrun(trainJob(members), trainResult(members), opts)).length;
}
