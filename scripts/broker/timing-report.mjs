// timing-report.mjs — the current top blockers with their trend (KIT-D121): `broker blockers [--since 24h|7d]
// [--top N] [--json]`. Reads every lane of the checkout.
//
//   checkoutSamples(rootCfg)               -> timing samples of every lane
//   blockersReport(rootCfg, { since, topN, now }) -> { data, text }
//   describe(row)                          -> one line for a ranked row

import { laneConfigs, withLane } from './config.mjs';
import { parseSince } from './metrics.mjs';
import { dirtyLines } from './timing-dirty.mjs';
import { DEFAULT_TOP, DEFAULT_WINDOW_MS, profile } from './timing-profile.mjs';
import { laneSamples } from './timing-sample.mjs';

const MS_PER_MIN = 60000;
const MS_PER_HOUR = 3600000;
const PERCENT = 100;
const mins = (ms) => (ms / MS_PER_MIN).toFixed(1);

export const checkoutSamples = (rootCfg) => laneConfigs(withLane(rootCfg, null)).flatMap(laneSamples);

const movement = (row) => (row.prevRank ? (row.prevRank === row.rank ? `#${row.rank} unchanged` : `#${row.rank} (was #${row.prevRank})`) : `#${row.rank} (new)`);
const delta = (row) => (row.deltaPct == null ? 'no earlier window' : `${row.deltaPct >= 0 ? '+' : ''}${row.deltaPct.toFixed(0)}% per job`);

export const describe = (row) => `${row.kind} ${row.key} in ${row.project}/${row.lane}: ${mins(row.ms)} min, ${(row.share * PERCENT).toFixed(0)}% of its ${row.kind} time, ${mins(row.perJobMs)} min/job, ${row.trend} (${delta(row)}), ${movement(row)}`;

export function blockersReport(rootCfg, { since = null, topN = DEFAULT_TOP, now = Date.now() } = {}) {
  const from = since ? parseSince(since, now) : null;
  const windowMs = from == null ? DEFAULT_WINDOW_MS : Math.max(1, now - from);
  const data = profile(checkoutSamples(rootCfg), { now, windowMs, topN });
  const lines = data.top.length ? data.top.map((row, i) => `${i + 1}. ${describe(row)}`) : ['no timed jobs in the window'];
  const cache = Object.entries(data.cache).map(([lane, c]) => `${lane} ${c.hits}/${c.hits + c.misses} cargo commands compiled nothing`);
  const head = `broker blockers (waste first), last ${(windowMs / MS_PER_HOUR).toFixed(1)} h vs the window before (${rootCfg.root}):`;
  const flagged = data.byKind.flagged.map((row) => `  ${describe(row)}`);
  const outside = flagged.length ? ['test runs outside the change\'s reach, by outcome (advisory; the data an auto-skip needs):', ...flagged] : [];
  return { data, text: [head, ...lines, ...outside, ...dirtyLines(data.byKind.dirty), ...(cache.length ? [`cache hits: ${cache.join('; ')}`] : [])].join('\n') };
}
