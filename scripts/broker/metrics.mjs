// metrics.mjs — how well the broker is running, aggregated from a checkout's result files (KIT-T506).
// `broker stats [--since 24h|7d|<ISO>] [--json]` prints the report; orient prints `rollupLine`.
//
// Measured against the ST-T904 target: each green job waits at most TARGET_X times the single-job
// wall time (the median run time of jobs that ran alone, else of all jobs).
//
// `metrics(results, { target })` → { jobs, greens, wait, phases, rates, batches, sessions, stallKills,
//   recovered, resumed, retries, target: { x, singleS, meeting, of, share } }.
// `parseSince(text, now)` → ms | null.  `statsReport(cfg, { since, now })` → { text, data }.
// `rollupLine(cfg, now)` → string | null.

import { brokerPaths } from './config.mjs';
import { loadResults, submittedAt } from './stats.mjs';

export const TARGET_X = 1.5;
const MS_PER_S = 1000;
const MS_PER_MIN = 60000;
const MS_PER_HOUR = 3600000;
const GREEN = new Set(['passed', 'landed']);
const FAILED = new Set(['failed', 'gate', 'conflict', 'stale', 'dirty']);
const BUILD = /\b(check|build|clippy)\b/;
const TEST = /\b(test|nextest)\b/;

const quantile = (list, q) => {
  if (!list.length) return null;
  const s = [...list].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(s.length * q))];
};
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const share = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : null);

export function parseSince(text, now = Date.now()) {
  const m = /^(\d+(?:\.\d+)?)([hd])$/.exec(String(text || ''));
  if (m) return now - Number(m[1]) * (m[2] === 'h' ? MS_PER_HOUR : 24 * MS_PER_HOUR);
  const t = Date.parse(text);
  return Number.isFinite(t) ? t : null;
}

const spans = (results) => results.map((r) => ({ r, wait: Date.parse(r.startedAt) - submittedAt(r.id), run: Date.parse(r.finishedAt) - Date.parse(r.startedAt) }))
  .filter((j) => j.wait >= 0 && j.run >= 0);

function commandMinutes(jobs, re) {
  let ms = 0;
  for (const { r } of jobs) for (const c of r.commands || []) if (!c.reusedFrom && re.test(c.cmd || '') && Number.isFinite(c.durationMs)) ms += c.durationMs;
  return r1(ms / MS_PER_MIN);
}

function gateMinutes(jobs) {
  let ms = 0;
  for (const { r } of jobs) for (const t of r.timings || []) if (/gate/.test(t.phase)) ms += t.ms;
  return r1(ms / MS_PER_MIN);
}

function batches(jobs) {
  const trains = new Map();
  for (const { r } of jobs) if (r.train) trains.set(r.train.id, r.train.size || (r.train.members || []).length || 1);
  const sizes = [...trains.values()];
  return {
    trains: sizes.length, solo: jobs.filter(({ r }) => !r.train).length,
    meanSize: sizes.length ? r1(sizes.reduce((a, b) => a + b, 0) / sizes.length) : null, maxSize: sizes.length ? Math.max(...sizes) : null,
  };
}

function sessions(jobs) {
  const by = new Map();
  for (const j of jobs) {
    const key = j.r.session || 'unknown';
    by.set(key, [...(by.get(key) || []), j.wait]);
  }
  const rows = [...by].map(([session, waits]) => ({ session, jobs: waits.length, medianWaitS: r1(quantile(waits, 0.5) / MS_PER_S) }));
  const meds = rows.filter((x) => x.session !== 'unknown').map((x) => x.medianWaitS);
  return { rows: rows.sort((a, b) => b.jobs - a.jobs), spread: meds.length > 1 && Math.min(...meds) > 0 ? r1(Math.max(...meds) / Math.min(...meds)) : null };
}

export function metrics(results, { target = TARGET_X } = {}) {
  const jobs = spans(results);
  const greens = jobs.filter(({ r }) => GREEN.has(r.status));
  const settled = jobs.filter(({ r }) => r.status !== 'cancelled' && r.status !== 'superseded');
  const solo = jobs.filter(({ r }) => !r.train && (r.commands || []).some((c) => !c.reusedFrom));
  const singleMs = quantile((solo.length ? solo : jobs).map((j) => j.run), 0.5);
  const meeting = singleMs == null ? 0 : greens.filter((j) => j.wait <= target * singleMs).length;
  const waits = jobs.map((j) => j.wait);
  return {
    jobs: jobs.length, greens: greens.length,
    wait: { medianS: r1(quantile(waits, 0.5) / MS_PER_S), p90S: r1(quantile(waits, 0.9) / MS_PER_S), totalMin: r1(waits.reduce((a, b) => a + b, 0) / MS_PER_MIN) },
    phases: { buildMin: commandMinutes(jobs, BUILD), testMin: commandMinutes(jobs, TEST), gateMin: gateMinutes(jobs) },
    rates: {
      failurePct: share(settled.filter(({ r }) => FAILED.has(r.status)).length, settled.length),
      redPct: share(settled.filter(({ r }) => (r.commands || []).some((c) => c.exit !== 0 && !c.foreign)).length, settled.length),
    },
    batches: batches(jobs),
    sessions: sessions(jobs),
    stallKills: jobs.filter(({ r }) => r.killed).length,
    recovered: jobs.filter(({ r }) => r.recovered || (r.commands || []).some((c) => c.recovered)).length,
    resumed: jobs.filter(({ r }) => r.resumed).length,
    retries: jobs.filter(({ r }) => (r.revision || 1) > 1).length,
    target: { x: target, singleS: r1(singleMs == null ? null : singleMs / MS_PER_S), meeting, of: greens.length, share: share(meeting, greens.length) },
  };
}

const pct = (v) => (v == null ? '-' : `${v}%`);
const sec = (v) => (v == null ? '-' : `${v}s`);

function textOf(m, label) {
  if (!m.jobs) return [`${label}: no jobs`];
  const t = m.target;
  const who = m.sessions.rows.map((s) => `${s.session} ${s.jobs} jobs/${sec(s.medianWaitS)}`).join(', ');
  return [
    `${label}: ${m.jobs} jobs, ${m.greens} green; queue wait median ${sec(m.wait.medianS)}, p90 ${sec(m.wait.p90S)}, ${m.wait.totalMin} min total`,
    `  minutes: build ${m.phases.buildMin}, test ${m.phases.testMin}, gate ${m.phases.gateMin}`,
    `  rates: failed ${pct(m.rates.failurePct)}, red ${pct(m.rates.redPct)}; stall kills ${m.stallKills}, recovered ${m.recovered}, resumed ${m.resumed}, retried revisions ${m.retries}`,
    `  batches: ${m.batches.trains} trains (mean ${m.batches.meanSize ?? '-'}, max ${m.batches.maxSize ?? '-'}), ${m.batches.solo} solo`,
    `  sessions: ${who}${m.sessions.spread ? `; slowest/fastest median wait ${m.sessions.spread}x` : ''}`,
    `  ST-T904: ${pct(t.share)} of ${t.of} greens waited within ${t.x}x the single-job wall time (${sec(t.singleS)})`,
  ];
}

export function statsReport(cfg, { since = null, now = Date.now() } = {}) {
  const from = since ? parseSince(since, now) : null;
  const results = loadResults(brokerPaths(cfg).results).filter((r) => from == null || submittedAt(r.id) >= from);
  const data = metrics(results);
  return { data, text: textOf(data, `broker stats${since ? ` since ${since}` : ''} (${cfg.root})`).join('\n') };
}

/** One orient line for the last 24 h; null when no job ran in the window. */
export function rollupLine(cfg, now = Date.now()) {
  const m = statsReport(cfg, { since: '24h', now }).data;
  if (!m.jobs) return null;
  const t = m.target;
  return `  broker 24h: ${m.jobs} jobs (${m.greens} green), wait median ${sec(m.wait.medianS)} p90 ${sec(m.wait.p90S)}, failed ${pct(m.rates.failurePct)}, ${m.stallKills} stall kill(s); ST-T904 ${pct(t.share)} of greens within ${t.x}x single-job time`;
}
