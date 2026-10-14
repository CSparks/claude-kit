#!/usr/bin/env node
// stats.mjs — how fast the broker queue moved, read from its result files (KIT-T482). Each job's
// submit time comes from its id (j-<base36 ms>-…). Waiting is split into time spent behind a
// running job (the single writer's queue) and time the daemon ran no job at all (paused, down,
// running the suite). A train counts as its builds, a solo job as one.
//
// USE: node scripts/broker/stats.mjs --root <checkout> [--split <ISO time>] [--json]
//   --split  report the jobs submitted before and after that moment side by side (a deploy, a config flip)
//
// `summarize(results)` → { jobs, statuses, trains, builds, waitMin, behindMin, idleMin, medianWaitS,
//   p90WaitS, medianRunS, medianFirstCmdS }; `loadResults(dir)` → the parsed result files.

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const MS_PER_S = 1000;
const MS_PER_MIN = 60000;
const P90 = 0.9;
const BASE36 = 36;

export const submittedAt = (id) => parseInt(String(id).split('-')[1], BASE36);

export function loadResults(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
    try { return JSON.parse(readFileSync(join(dir, f), 'utf8')); } catch { return null; }
  }).filter((r) => r && r.startedAt && r.finishedAt && Number.isFinite(submittedAt(r.id)));
}

const quantile = (list, q) => {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
};
const round = (x, unit) => (x == null ? null : Math.round((x / unit) * 10) / 10);

// Overlap of [a, b) with the union of `spans`.
function covered(a, b, spans) {
  let ms = 0;
  for (const [s, e] of spans) { const lo = Math.max(a, s); const hi = Math.min(b, e); if (hi > lo) ms += hi - lo; }
  return Math.min(ms, b - a);
}

export function summarize(results) {
  const jobs = results.map((r) => ({ r, sub: submittedAt(r.id), start: Date.parse(r.startedAt), end: Date.parse(r.finishedAt) }))
    .filter((j) => j.start >= j.sub);
  const statuses = {};
  for (const { r } of jobs) statuses[r.status] = (statuses[r.status] || 0) + 1;
  const trains = new Map();
  for (const { r } of jobs) if (r.train) trains.set(r.train.id, Math.max(trains.get(r.train.id) || 0, r.train.builds || 1));
  const ran = jobs.filter(({ r }) => (r.commands || []).some((c) => !c.reusedFrom));
  const builds = [...trains.values()].reduce((a, b) => a + b, 0) + ran.filter(({ r }) => !r.train).length;
  const spans = jobs.map((j) => [j.start, j.end]);
  let behind = 0;
  let idle = 0;
  for (const j of jobs) { const c = covered(j.sub, j.start, spans); behind += c; idle += j.start - j.sub - c; }
  const waits = jobs.map((j) => j.start - j.sub);
  const firstCmd = ran.map(({ r }) => r.commands.find((c) => !c.reusedFrom)).filter((c) => c && Number.isFinite(c.durationMs)).map((c) => c.durationMs);
  return {
    jobs: jobs.length, statuses, trains: trains.size, builds,
    waitMin: round(behind + idle, MS_PER_MIN), behindMin: round(behind, MS_PER_MIN), idleMin: round(idle, MS_PER_MIN),
    medianWaitS: round(quantile(waits, 0.5), MS_PER_S), p90WaitS: round(quantile(waits, P90), MS_PER_S),
    medianRunS: round(quantile(jobs.map((j) => j.end - j.start), 0.5), MS_PER_S), medianFirstCmdS: round(quantile(firstCmd, 0.5), MS_PER_S),
  };
}

const line = (label, s) => `${label}: ${s.jobs} jobs (${Object.entries(s.statuses).map(([k, v]) => `${k} ${v}`).join(', ')}); `
  + `${s.builds} builds, ${s.trains} trains; waited ${s.waitMin} min (${s.behindMin} behind a running job, ${s.idleMin} with no job running); `
  + `median wait ${s.medianWaitS}s, p90 ${s.p90WaitS}s; median run ${s.medianRunS}s; median first command ${s.medianFirstCmdS}s`;

function main(argv) {
  const arg = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
  const root = arg('--root') || process.cwd();
  const all = loadResults(join(root, 'target', 'broker', 'results'));
  const split = arg('--split') ? Date.parse(arg('--split')) : null;
  const parts = split ? { before: all.filter((r) => submittedAt(r.id) < split), after: all.filter((r) => submittedAt(r.id) >= split) } : { all };
  const out = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, summarize(v)]));
  if (argv.includes('--json')) console.log(JSON.stringify(out, null, 2));
  else for (const [k, s] of Object.entries(out)) console.log(line(k, s));
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv.slice(2));
