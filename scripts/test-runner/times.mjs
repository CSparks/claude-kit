// times.mjs — per-file wall times of the last test run (KIT-T570), kept in .cache/test-times.json
// (gitignored; KIT_TEST_TIMES overrides the path so a publish export updates the source checkout's file).
//
//   readTimes(file)            -> { 'scripts/x.test.mjs': ms }  ({} when absent or unreadable)
//   writeTimes(file, results)  merge `results` [{ file, ms }] over the stored times
//   slowest(results, n)        -> the n slowest results, longest first
//   slowFiles(results, limitMs)  -> the results over limitMs
//   longestFirst(files, times) -> files ordered by stored time, longest first; unknown files lead (they may be long)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

export function readTimes(file) {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return parsed && typeof parsed.files === 'object' ? parsed.files : {};
  } catch { return {}; }
}

export function writeTimes(file, results) {
  const files = { ...readTimes(file), ...Object.fromEntries(results.map((r) => [r.file, Math.round(r.ms)])) };
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify({ updatedAt: new Date().toISOString(), files }, null, 2)}\n`);
  } catch { /* timings are an optimisation; a read-only checkout still runs */ }
}

export const slowFiles = (results, limitMs) => results.filter((r) => r.ms > limitMs);

export const slowest = (results, n) => [...results].sort((a, b) => b.ms - a.ms).slice(0, n);

export function longestFirst(files, times) {
  const unknown = files.filter((f) => times[f] === undefined);
  const known = files.filter((f) => times[f] !== undefined).sort((a, b) => times[b] - times[a]);
  return [...unknown, ...known];
}

// When each file last passed (KIT-D104 rotation): { 'scripts/x.test.mjs': epochMs }, beside the times file.
export function readRan(file) {
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return {}; }
}

export function writeRan(file, passed, now = Date.now()) {
  const ran = { ...readRan(file), ...Object.fromEntries(passed.map((f) => [f, now])) };
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(ran, null, 2));
  } catch { /* rotation is an optimisation; a read-only checkout still runs */ }
}
