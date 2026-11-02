// times.mjs — per-file wall times of the last test run (KIT-T570), kept in .cache/test-times.json
// (gitignored; KIT_TEST_TIMES overrides the path so a publish export updates the source checkout's file).
// Each record carries the epoch ms it was measured at; a record older than STALE_AFTER_MS, or one with no stamp,
// is untrusted and planning treats the file as unmeasured until the next run of it rewrites the record (KIT-T839).
//
//   readTimes(file)            -> { 'scripts/x.test.mjs': ms }  ({} when absent or unreadable)
//   readStamps(file)           -> { 'scripts/x.test.mjs': epochMs }
//   writeTimes(file, results, now)  merge `results` [{ file, ms }] and their stamps over the stored record
//   trustedTimes(times, stamps, now) -> the times measured within STALE_AFTER_MS
//   staleFiles(times, stamps, now)   -> the files whose record is untrusted
//   slowest(results, n)        -> the n slowest results, longest first
//   slowFiles(results, limitMs)  -> the results over limitMs
//   longestFirst(files, times) -> files ordered by stored time, longest first; unknown files lead (they may be long)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const MS_PER_DAY = 24 * 3600 * 1000;
const STALE_AFTER_DAYS = 7;
export const STALE_AFTER_MS = STALE_AFTER_DAYS * MS_PER_DAY;

function readStore(file) {
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return parsed && typeof parsed.files === 'object' ? parsed : {};
  } catch { return {}; }
}

export const readTimes = (file) => readStore(file).files || {};

export const readStamps = (file) => readStore(file).stamps || {};

export function writeTimes(file, results, now = Date.now()) {
  const files = { ...readTimes(file), ...Object.fromEntries(results.map((r) => [r.file, Math.round(r.ms)])) };
  const stamps = { ...readStamps(file), ...Object.fromEntries(results.map((r) => [r.file, now])) };
  try {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, `${JSON.stringify({ updatedAt: new Date(now).toISOString(), files, stamps }, null, 2)}\n`);
  } catch { /* timings are an optimisation; a read-only checkout still runs */ }
}

const isFresh = (stamps, file, now) => now - (stamps[file] ?? -Infinity) <= STALE_AFTER_MS;

export const trustedTimes = (times, stamps, now = Date.now()) => Object.fromEntries(Object.entries(times).filter(([file]) => isFresh(stamps, file, now)));

export const staleFiles = (times, stamps, now = Date.now()) => Object.keys(times).filter((file) => !isFresh(stamps, file, now));

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
