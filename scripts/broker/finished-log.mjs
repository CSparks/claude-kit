// finished-log.mjs — one line per finished job, for the orchestrator's single Monitor (KIT-D115).
// `<target>/broker/finished.log` is shared by every lane; a line reads
//   <ISO time> <job id> <verdict> agent=<id|-> ticket=<id|-> [landed=<sha>]
//
//   finishedLine(result, now)    -> the line, or null for a result that is not final (a dirty hold)
//   recordFinished(cfg, result)  -> appends it (best effort)
//   readFinished(brokerDir)      -> the parsed tail of the log

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const FINISHED_LOG = 'finished.log';
const DIRTY = 'dirty';

export function finishedLine(result, now = new Date()) {
  if (!result || !result.id || result.status === DIRTY) return null;
  const landed = result.landed && result.landed.sha ? ` landed=${result.landed.sha}` : '';
  return `${now.toISOString()} ${result.id} ${result.status} agent=${result.agent || '-'} ticket=${result.ticket || '-'}${landed}`;
}

const LINE = /^(\S+) (\S+) (\S+) agent=(\S+) ticket=(\S+)(?: landed=(\S+))?$/;
const FINISHED_TAIL = 3000;
const NONE = '-';

// The log's tail as [{ ts, job, verdict, agent, ticket, landed }], oldest first; '-' fields read as null.
export function readFinished(brokerDir) {
  try {
    const lines = readFileSync(join(brokerDir, FINISHED_LOG), 'utf8').split('\n').filter(Boolean).slice(-FINISHED_TAIL);
    return lines.flatMap((l) => {
      const m = LINE.exec(l);
      return m ? [{ ts: m[1], job: m[2], verdict: m[3], agent: m[4] === NONE ? null : m[4], ticket: m[5] === NONE ? null : m[5], landed: m[6] || null }] : [];
    });
  } catch { return []; }
}

export function recordFinished(cfg, result) {
  try {
    const line = finishedLine(result);
    if (!line) return;
    const dir = join(cfg.targetDir, 'broker');
    mkdirSync(dir, { recursive: true });
    appendFileSync(join(dir, FINISHED_LOG), `${line}\n`);
  } catch { /* the line is a signal, never a reason to fail a job */ }
}
