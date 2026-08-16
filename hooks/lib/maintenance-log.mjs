// Machine-local log of maintenance gaps a hook noticed but could not fix. Best-effort:
// a write failure is swallowed so gap logging can never break a hook.

import { existsSync, readFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const MAINT_LOG = join(homedir(), '.claude', 'maintenance-gaps.log');

// Append a maintenance gap once. Dedup on the (kind, file, detail) triple,
// ignoring the timestamp prefix — so a recurring gap is recorded a single time.
export function logGap(kind, file, detail) {
  const row = `${kind}\t${file}\t${detail}`;
  try {
    const existing = existsSync(MAINT_LOG) ? readFileSync(MAINT_LOG, 'utf8') : '';
    if (existing.split('\n').some((l) => l.endsWith(row))) return;
    appendFileSync(MAINT_LOG, `${new Date().toISOString()}\t${row}\n`);
  } catch {
    /* gap logging is best-effort — never let it break a hook */
  }
}
