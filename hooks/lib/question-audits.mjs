// question-audits — the machine-local record of audited questionnaires (KIT-D152): one line per call, with the parts
// its summary lacked. The Stop backstop skips calls already recorded; orient reads the misses to show a repeat offender.
// The file lives in `<claude home>/claude-kit-state` and is trimmed to its newest MAX_LINES lines.
//
//   recordAudit({ session, project, call, parts, now? })   append one line ([] parts = a sound summary)
//   auditedCalls()                                         Set of every recorded call id
//   missesSince({ project, days, now? })                   [{ session, count }] thin summaries per session, most first

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { stateDir } from './reap-state.mjs';
import { MS_PER_DAY } from './time.mjs';

const FILE = 'question-audits.jsonl';
const MAX_LINES = 2000;

const path = () => join(stateDir(), FILE);

function readEntries() {
  try {
    return readFileSync(path(), 'utf8').split('\n').filter(Boolean).flatMap((line) => { try { return [JSON.parse(line)]; } catch { return []; } });
  } catch { return []; }
}

export function recordAudit({ session, project, call, parts, now = Date.now() }) {
  try {
    appendFileSync(path(), `${JSON.stringify({ at: now, session: session || '', project: project || '', call, parts })}\n`);
    const entries = readEntries();
    if (entries.length > MAX_LINES) writeFileSync(path(), `${entries.slice(-MAX_LINES).map((e) => JSON.stringify(e)).join('\n')}\n`);
  } catch { /* the record is best-effort */ }
}

export const auditedCalls = () => new Set(readEntries().map((e) => e.call));

export function missesSince({ project, days, now = Date.now() }) {
  const since = now - days * MS_PER_DAY;
  const counts = new Map();
  for (const e of readEntries()) {
    if (e.project !== project || e.at < since || !e.parts?.length) continue;
    counts.set(e.session, (counts.get(e.session) || 0) + 1);
  }
  return [...counts].map(([session, count]) => ({ session, count })).sort((a, b) => b.count - a.count);
}
