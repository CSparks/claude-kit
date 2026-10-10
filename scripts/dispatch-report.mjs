// dispatch-report.mjs — what the outcome ledger says about the capability table (KIT-T419).
// Routing decides how fast the weekly usage limit is hit, so the metric is tokens per LANDING by model.
//
//   jobStats(outcomes)                 -> { job: { model: { landings, failures, tokens, tokensPerLanding } } }
//   proposals(outcomes, jobs, opts)    -> [{ kind: 'downgrade'|'flag', job, from, to, count, text }]
//   dispatchLine(roots)                -> one `!! dispatch:` orient line, or null when nothing is open
//   CLI: node dispatch-report.mjs [--root <repo>]... [--json]
//
// Only outcomes newer than a job's table `evidence` date count: re-dating a row consumes its evidence.
// downgrade: a cheaper family landed >= MIN_LANDINGS with no failure while the row names a dearer one.
// flag: a dearer family than the row's ran >= FLAG_RUNS times.

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLadder } from './dispatch-ladder.mjs';
import { readOutcomes } from '../hooks/lib/dispatch-ledger.mjs';
import { gitRoot } from '../hooks/lib/paths.mjs';

export const MIN_LANDINGS = 3;
export const FLAG_RUNS = 2;
const RANK = { 'local-qwen': 0, haiku: 1, sonnet: 2, opus: 3, fable: 4 };

export function jobStats(outcomes) {
  const stats = {};
  for (const o of outcomes) {
    if (!o.job) continue;
    const s = ((stats[o.job] ||= {})[o.model || 'unknown'] ||= { landings: 0, failures: 0, tokens: 0, tokensPerLanding: null });
    if (o.outcome === 'failed') s.failures++;
    else s.landings++;
    s.tokens += typeof o.tokens === 'number' ? o.tokens : 0;
  }
  for (const byModel of Object.values(stats)) {
    for (const s of Object.values(byModel)) s.tokensPerLanding = s.landings ? Math.round(s.tokens / s.landings) : null;
  }
  return stats;
}

const newerThan = (date) => (o) => !date || String(o.ts || '').slice(0, 10) > date;

export function proposals(outcomes, jobs, { minLandings = MIN_LANDINGS, flagRuns = FLAG_RUNS } = {}) {
  const out = [];
  for (const [job, row] of Object.entries(jobs)) {
    const rowRank = RANK[row.family];
    if (rowRank === undefined || row.explicit_only) continue;
    const byModel = jobStats(outcomes.filter((o) => o.job === job).filter(newerThan(row.evidence)))[job] || {};
    for (const [model, s] of Object.entries(byModel)) {
      const rank = RANK[model];
      if (rank === undefined) continue;
      if (rank < rowRank && rank >= RANK.haiku && s.landings >= minLandings && s.failures === 0) {
        out.push({ kind: 'downgrade', job, from: row.family, to: model, count: s.landings, text: `${model} landed ${s.landings} ${job} dispatches with no failure while the row says ${row.family} -> propose downgrade` });
      } else if (rank > rowRank && s.landings + s.failures >= flagRuns) {
        out.push({ kind: 'flag', job, from: row.family, to: model, count: s.landings + s.failures, text: `${model} used on the ${row.family} row ${job} ${s.landings + s.failures} times -> flag` });
      }
    }
  }
  return out;
}

function ledger(roots) {
  return [...new Set(roots.map((r) => resolve(r)))].flatMap((r) => readOutcomes(r));
}

export function dispatchLine(roots) {
  const open = proposals(ledger(roots), readLadder().jobs);
  if (!open.length) return null;
  const shown = open.slice(0, 3).map((p) => `${p.job}: ${p.kind === 'downgrade' ? `${p.from}->${p.to} (${p.count} landed clean)` : `${p.to} on ${p.from} row x${p.count}`}`);
  return `!! dispatch: ${open.length} open proposal(s) — ${shown.join('; ')}${open.length > 3 ? '; ...' : ''} — node scripts/dispatch-report.mjs`;
}

function render(stats, open) {
  const lines = ['job  model  landings  failures  tokens/landing (cheapest first)'];
  for (const [job, byModel] of Object.entries(stats).sort(([a], [b]) => a.localeCompare(b))) {
    const ranked = Object.entries(byModel).sort(([, a], [, b]) => (a.tokensPerLanding ?? Infinity) - (b.tokensPerLanding ?? Infinity));
    for (const [model, s] of ranked) lines.push(`${job}  ${model}  ${s.landings}  ${s.failures}  ${s.tokensPerLanding ?? '-'}`);
  }
  lines.push('', open.length ? 'proposals:' : 'proposals: none', ...open.map((p) => `  ${p.text}`));
  return lines.join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const roots = [];
  process.argv.forEach((a, i) => { if (a === '--root') roots.push(process.argv[i + 1]); });
  if (!roots.length) roots.push(gitRoot());
  const outcomes = ledger(roots);
  const open = proposals(outcomes, readLadder().jobs);
  console.log(process.argv.includes('--json') ? JSON.stringify({ stats: jobStats(outcomes), proposals: open }, null, 2) : outcomes.length ? render(jobStats(outcomes), open) : 'no dispatch outcomes recorded');
}
