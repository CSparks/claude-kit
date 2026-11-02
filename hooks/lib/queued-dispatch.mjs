// queued-dispatch.mjs — a dispatch the guard refused only because its [paths:] overlap an in-flight worker is not lost:
// it waits behind that worker as a durable row, and the hand-back reconciler holds the brief (KIT-T828).
//   <root>/.ai/queued-dispatch.jsonl   append-only rows { ts, id, tickets, blockedBy, scope, brief }
//
//   queueDispatch(root, { tickets, blockedBy, scope, brief }) -> the queued row's id; one row per blocker and ticket set
//   readQueued(root)                                          -> the rows, newest brief per id, oldest first

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export const QUEUE_REL = '.ai/queued-dispatch.jsonl';
const BRIEF_MAX = 6000;

export function queueDispatch(root, { tickets = [], blockedBy, scope = '', brief = '' }) {
  const id = `q-${blockedBy}-${[...tickets].sort().join('+') || 'none'}`;
  try {
    const file = join(root, QUEUE_REL);
    mkdirSync(dirname(file), { recursive: true });
    appendFileSync(file, `${JSON.stringify({ ts: new Date().toISOString(), id, tickets, blockedBy, scope, brief: String(brief).slice(0, BRIEF_MAX) })}\n`);
  } catch { /* the guard still refuses; the row is a recovery aid */ }
  return id;
}

export function readQueued(root) {
  const byId = new Map();
  try {
    for (const line of readFileSync(join(root, QUEUE_REL), 'utf8').split('\n').filter(Boolean)) {
      try { const row = JSON.parse(line); byId.set(row.id, { ...byId.get(row.id), ...row }); } catch { /* skip a malformed row */ }
    }
  } catch { /* no queue yet */ }
  return [...byId.values()];
}
