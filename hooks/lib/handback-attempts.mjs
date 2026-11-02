// handback-attempts.mjs — the record that the reconciler SURFACED a recovery step (KIT-T822), so a gate can tell
// "never tried" from "tried and the step did not happen".
//   <target>/broker/resume-attempts.jsonl   one row per surfacing: { key, step, ts }
//
//   readAttempts(brokerDir)            -> Map key -> { count, first }
//   noteAttempts(brokerDir, items)     -> appends a row for each item; items carry key and step

import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export const ATTEMPTS_LOG = 'resume-attempts.jsonl';

export function readAttempts(brokerDir) {
  const out = new Map();
  try {
    for (const line of readFileSync(join(brokerDir, ATTEMPTS_LOG), 'utf8').split('\n').filter(Boolean)) {
      try {
        const row = JSON.parse(line);
        const prev = out.get(row.key);
        out.set(row.key, { count: (prev?.count || 0) + 1, first: prev?.first || row.ts });
      } catch { /* skip a malformed row */ }
    }
  } catch { /* no log yet */ }
  return out;
}

export function noteAttempts(brokerDir, items) {
  if (!items.length) return;
  try {
    mkdirSync(brokerDir, { recursive: true });
    const ts = new Date().toISOString();
    appendFileSync(join(brokerDir, ATTEMPTS_LOG), items.map((i) => `${JSON.stringify({ key: i.key, step: i.step, ts })}\n`).join(''));
  } catch { /* best effort */ }
}
