// reopened.mjs — a SendMessage that resumes a retired worker and names its ticket takes the worker's handoff over (KIT-T837).
// The resume-check hook records one row per message; the reconciler (handback.mjs) treats the owed work as in progress
// until the agent retires again, and re-surfaces it only when the agent stays silent past SILENT_MS.
//   <root>/.ai/reopened.jsonl   append-only rows { ts, agent, tickets }
//
//   recordReopen(root, { agent, tickets })           -> appends a row; never throws
//   reopenState(root, row, ticket, { nowMs, since }) -> 'active' (reopened after `since`, agent output seen within SILENT_MS),
//                                                      'silent' (reopened, no output for SILENT_MS), or null (not reopened)
//   SILENT_MS                                        -> minutes without output before a reopened agent counts as silent

import { appendFileSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { sameAgent } from '../../scripts/broker/finished-ack.mjs';

export const SILENT_MS = 30 * 60 * 1000;
const REOPENED_REL = join('.ai', 'reopened.jsonl');

export function recordReopen(root, { agent, tickets = [] }) {
  try {
    if (!agent || !tickets.length) return;
    const file = join(root, REOPENED_REL);
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify({ ts: new Date().toISOString(), agent, tickets })}\n`);
  } catch { /* the record is best-effort: a failed write never blocks a resume */ }
}

function readReopens(root) {
  try {
    return readFileSync(join(root, REOPENED_REL), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  } catch { return []; }
}

const lastOutputMs = (row) => {
  try { return statSync(row.outputFile).mtimeMs; } catch { return 0; }
};

export function reopenState(root, row, ticket, { nowMs = Date.now(), since = '' } = {}) {
  const latest = readReopens(root)
    .filter((r) => sameAgent(r.agent, row.id) && r.tickets.includes(ticket) && r.ts > since)
    .sort((a, b) => b.ts.localeCompare(a.ts))[0];
  if (!latest) return null;
  const lastSeen = Math.max(Date.parse(latest.ts), lastOutputMs(row));
  return nowMs - lastSeen > SILENT_MS ? 'silent' : 'active';
}
