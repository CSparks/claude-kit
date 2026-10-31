// timing-tuning.mjs — the settings the timing controller owns, kept per lane in tuning.json (KIT-D121), and the
// baseline re-run budget derived from the lane's own history instead of a fixed number of seconds.
//
//   tuningFiles(cfg)                       -> { state, log, tuning } paths in the lane's broker home
//   readJson(file, fallback), setTuning(cfg, patch), logCorrection(cfg, row)
//   tunedBatchWindowMs(cfg)                -> the batch window the controller set (0 when none)
//   tunedBaselineBudgetMs(cfg)             -> how long a job may have run before its attribution re-run is skipped;
//                                             Infinity until the lane has history, so a new lane always attributes
//   refreshBaselineBudget(cfg, samples, now) -> the p90 of the lane's recent run time, stored and logged when it moves

import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { brokerPaths } from './config.mjs';
import { PHASE } from './timing-sample.mjs';

const P90 = 0.9;
const RUN_PHASES = new Set(['queue', 'compile', 'test', 'command', 'run-idle']);

export const tuningFiles = (cfg) => {
  const { home } = brokerPaths(cfg);
  return { state: join(home, 'corrections.json'), log: join(home, 'corrections.jsonl'), tuning: join(home, 'tuning.json') };
};

export const readJson = (file, fallback) => { try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return fallback; } };
export const setTuning = (cfg, patch) => writeFileSync(tuningFiles(cfg).tuning, JSON.stringify({ ...readJson(tuningFiles(cfg).tuning, {}), ...patch }));
export const logCorrection = (cfg, row) => appendFileSync(tuningFiles(cfg).log, `${JSON.stringify(row)}\n`);

export const tunedBatchWindowMs = (cfg) => Number(readJson(tuningFiles(cfg).tuning, {}).batchWindowMs) || 0;
export const tunedBaselineBudgetMs = (cfg) => Number(readJson(tuningFiles(cfg).tuning, {}).baselineBudgetMs) || Infinity;

const runMs = (sample) => sample.entries.filter((e) => e.kind === PHASE && RUN_PHASES.has(e.key)).reduce((a, e) => a + e.ms, 0);

export function refreshBaselineBudget(cfg, samples, now = Date.now()) {
  const runs = samples.map(runMs).filter((ms) => ms > 0).sort((a, b) => a - b);
  if (!runs.length) return null;
  const budgetMs = Math.round(runs[Math.min(runs.length - 1, Math.floor(runs.length * P90))]);
  if (budgetMs === tunedBaselineBudgetMs(cfg)) return null;
  setTuning(cfg, { baselineBudgetMs: budgetMs });
  logCorrection(cfg, { ts: new Date(now).toISOString(), lever: 'baseline-budget', decision: 'tuned', budgetMs, jobs: runs.length });
  return { lever: 'baseline-budget', decision: 'tuned', budgetMs };
}
