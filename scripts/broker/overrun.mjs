// overrun.mjs — a broker job over the 5-minute ceiling is a kit bug (KIT-D104). After each job the result's
// phase timings are summed; past CEILING_MS a `cap bug` goes to the claude-kit store naming the repo, the
// job, the dominant phase and its minutes, so a slow gate shows up as a ticket instead of a long wait.
//
//   overrun(result)                       -> { totalMs, phase, phaseMs } | null
//   reportOverrun(job, result, { fileBug }) -> true when a bug was filed (best effort, never throws)

import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export const CEILING_MS = 5 * 60 * 1000;
const CAP = join(import.meta.dirname, '..', 'cap.mjs');
const minutes = (ms) => (ms / 60000).toFixed(1);

export function overrun(result) {
  const timings = (result && result.timings) || [];
  const totalMs = timings.reduce((sum, t) => sum + (t.ms || 0), 0);
  if (totalMs <= CEILING_MS) return null;
  const top = timings.reduce((best, t) => ((t.ms || 0) > (best.ms || 0) ? t : best), timings[0]);
  const queuedMs = ((result && result.commands) || []).reduce((sum, c) => sum + (c.slotWaitMs || 0), 0);
  return { totalMs, phase: top.phase, phaseMs: top.ms, queuedMs };
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
    const text = `broker job over the 5-minute ceiling (KIT-D104): ${job.repo} ${o.phase} phase took ${minutes(o.phaseMs)} min of ${minutes(o.totalMs)} min total${queued}; job ${job.id}${job.ticket ? ` (${job.ticket})` : ''}, status ${result.status}; split, scope or speed up that phase`;
    return fileBug({ text });
  } catch { return false; }
}
