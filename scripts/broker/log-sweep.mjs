// log-sweep.mjs — the broker's per-job logs are removed once they are old (KIT-T914).
//
//   sweepLogs(paths, { now, keepDays }) -> names removed. Once per SWEEP_INTERVAL_MS (a marker file in the broker home
//     records the last pass), every job log under `paths.logs` (j-*, train-j-*, precheck-*, daemon-*, each with its
//     `.exit` sibling) and every precheck log an older broker left in `paths.home` older than `keepDays` is deleted.
//   LOG_KEEP_DAYS -> the retention

import { existsSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const LOG_KEEP_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const SWEEP_INTERVAL_MS = MS_PER_DAY;
const MARKER = 'logs-swept';
const JOB_LOG = /^(?:j-|train-j-|precheck-|daemon-).*\.log(?:\.exit)?$/;
const LEGACY_PRECHECK_LOG = /^precheck-.*\.log(?:\.exit)?$/;

function removeOld(dir, pattern, cutoff) {
  if (!existsSync(dir)) return [];
  const removed = [];
  for (const name of readdirSync(dir)) {
    if (!pattern.test(name)) continue;
    const file = join(dir, name);
    try {
      if (statSync(file).mtimeMs < cutoff) { rmSync(file, { force: true }); removed.push(name); }
    } catch { /* raced with another sweep */ }
  }
  return removed;
}

export function sweepLogs(paths, { now = Date.now(), keepDays = LOG_KEEP_DAYS } = {}) {
  const marker = join(paths.home, MARKER);
  try {
    if (existsSync(marker) && now - statSync(marker).mtimeMs < SWEEP_INTERVAL_MS) return [];
    writeFileSync(marker, new Date(now).toISOString());
  } catch { return []; }
  const cutoff = now - keepDays * MS_PER_DAY;
  return [...removeOld(paths.logs, JOB_LOG, cutoff), ...removeOld(paths.home, LEGACY_PRECHECK_LOG, cutoff)];
}
