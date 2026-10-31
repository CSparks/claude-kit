// timing-profile.mjs — the rolling profile of where broker wall time goes (KIT-D121). Samples fall into the current
// window and the window before it; entries are summed by project, lane, kind (waste, phase, crate, test) and key,
// ranked biggest first, and compared with the earlier window per job. No number of seconds decides anything, and
// waste ranks ahead of honest long work. The slot queue the box's waste causes is estimated as the lane's queue
// times waste's share of the box's command time.
//
//   profile(samples, { now, windowMs, topN }) -> { windowMs, now, jobs, cache, byKind, top }
//     row: { project, lane, kind, key, ms, share, perJobMs, prevPerJobMs, deltaPct, trend, rank, prevRank }
//     trend: 'new' | 'worse' | 'better' | 'flat'; top: waste first, then the topN rows of the other kinds
//     cache: { 'project|lane': { hits, misses } } for the current window
//   blockerId(row) -> 'project|lane|kind|key'

import { CRATE, PHASE, QUEUE, TEST } from './timing-sample.mjs';
import { WASTE } from './timing-waste.mjs';

export const CAUSED_QUEUE = 'slot queue caused by waste (estimate)';
const COMMAND_PHASES = new Set(['compile', 'test', 'command']);

const MS_PER_HOUR = 3600000;
const PERCENT = 100;
export const DEFAULT_WINDOW_MS = 24 * MS_PER_HOUR;
export const DEFAULT_TOP = 3;
const KINDS = [WASTE, PHASE, CRATE, TEST];

export const blockerId = (row) => [row.project, row.lane, row.kind, row.key].join('|');
const laneId = (s) => `${s.project}|${s.lane}`;

function windowOf(sample, now, windowMs) {
  if (sample.at > now - windowMs && sample.at <= now) return 'cur';
  return sample.at > now - 2 * windowMs && sample.at <= now - windowMs ? 'prev' : null;
}

function aggregate(samples, now, windowMs) {
  const jobs = new Map();
  const sums = new Map();
  const cache = {};
  for (const s of samples) {
    const w = windowOf(s, now, windowMs);
    if (!w) continue;
    const counts = jobs.get(laneId(s)) || { cur: 0, prev: 0 };
    counts[w] += 1;
    jobs.set(laneId(s), counts);
    if (w === 'cur' && s.cache) {
      const c = cache[laneId(s)] || { hits: 0, misses: 0 };
      cache[laneId(s)] = { hits: c.hits + s.cache.hits, misses: c.misses + s.cache.misses };
    }
    for (const e of s.entries) {
      const id = blockerId({ project: s.project, lane: s.lane, kind: e.kind, key: e.key });
      const row = sums.get(id) || { project: s.project, lane: s.lane, kind: e.kind, key: e.key, cur: 0, prev: 0 };
      row[w] += e.ms;
      sums.set(id, row);
    }
  }
  return { jobs, cache, sums: [...sums.values(), ...causedQueue([...sums.values()])] };
}

const sumOf = (rows, field, pick) => rows.filter(pick).reduce((a, r) => a + r[field], 0);

function causedQueue(rows) {
  const share = (field) => {
    const work = sumOf(rows, field, (r) => r.kind === PHASE && COMMAND_PHASES.has(r.key));
    return work ? sumOf(rows, field, (r) => r.kind === WASTE && r.key !== CAUSED_QUEUE) / work : 0;
  };
  return rows.filter((r) => r.kind === PHASE && r.key === QUEUE)
    .map((r) => ({ project: r.project, lane: r.lane, kind: WASTE, key: CAUSED_QUEUE, cur: r.cur * share('cur'), prev: r.prev * share('prev') }))
    .filter((r) => r.cur > 0 || r.prev > 0);
}

const trendOf = (perJob, prevPerJob) => (!prevPerJob ? 'new' : perJob > prevPerJob ? 'worse' : perJob < prevPerJob ? 'better' : 'flat');

function rankKind(rows, kind, jobs) {
  const ofKind = rows.filter((r) => r.kind === kind);
  const total = (r) => ofKind.filter((x) => x.project === r.project && x.lane === r.lane).reduce((a, x) => a + x.cur, 0);
  const prevRank = new Map([...ofKind].filter((r) => r.prev > 0).sort((a, b) => b.prev - a.prev).map((r, i) => [blockerId(r), i + 1]));
  return ofKind.filter((r) => r.cur > 0).sort((a, b) => b.cur - a.cur).map((r, i) => {
    const counts = jobs.get(`${r.project}|${r.lane}`);
    const perJobMs = r.cur / counts.cur;
    const prevPerJobMs = counts.prev ? r.prev / counts.prev : 0;
    return {
      project: r.project, lane: r.lane, kind, key: r.key, ms: r.cur, share: r.cur / total(r),
      perJobMs, prevPerJobMs, deltaPct: prevPerJobMs ? ((perJobMs - prevPerJobMs) / prevPerJobMs) * PERCENT : null,
      trend: trendOf(perJobMs, prevPerJobMs), rank: i + 1, prevRank: prevRank.get(blockerId(r)) || 0,
    };
  });
}

export function profile(samples, { now = Date.now(), windowMs = DEFAULT_WINDOW_MS, topN = DEFAULT_TOP } = {}) {
  const { jobs, cache, sums } = aggregate(samples, now, windowMs);
  const byKind = Object.fromEntries(KINDS.map((k) => [k, rankKind(sums, k, jobs)]));
  const top = KINDS.flatMap((k) => byKind[k].slice(0, topN));
  return { windowMs, now, jobs: Object.fromEntries([...jobs].map(([id, c]) => [id, c.cur])), cache, byKind, top };
}
