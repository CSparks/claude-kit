// timing-correct.mjs — the broker corrects the blocker it measures (KIT-D121). Each lever is tied to the phase it
// relieves. When that phase is a lane's top blocker the lever is applied, the lane's mean turnaround (submit to
// finish) is recorded, and once as many jobs as the baseline window held have finished the two means are compared:
// a lever that did not cut turnaround is reverted. Every step is logged to corrections.jsonl; a reverted lever
// waits out one baseline's worth of jobs before it is tried again.
//
//   selfCorrect(cfg, { now, windowMs, samples }) -> events [{ lever, decision, beforeMs, afterMs, jobs }]
//   correctingIds(cfg)                    -> blocker ids a lever is applied to or kept for (they are not ticketed)
//   Each tick also re-derives the baseline re-run budget from the lane's history (timing-tuning.mjs).
//   LEVERS                               -> the registry

import { writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { DEFAULT_WINDOW_MS, blockerId, profile } from './timing-profile.mjs';
import { PHASE, QUEUE, laneName, laneSamples } from './timing-sample.mjs';
import { logCorrection, readJson, refreshBaselineBudget, setTuning, tuningFiles } from './timing-tuning.mjs';

const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);
const median = (list) => (list.length ? [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] : 0);

// A lone job waits for a train peer: fewer builds, so fewer slot queues. The window is the median slot queue a job
// already sits through, so holding it costs a typical job nothing it was not paying. A hand-set window is left alone.
export const LEVERS = [{
  id: 'batch-window', kind: PHASE, key: QUEUE,
  plan: (cfg, samples) => {
    const waitMs = Math.floor(median(samples.map((s) => s.entries.find((e) => e.kind === PHASE && e.key === QUEUE)?.ms || 0).filter(Boolean)));
    return cfg.batchWindowMs > 0 || !waitMs ? null : { batchWindowMs: waitMs };
  },
  apply: (cfg, setting) => setTuning(cfg, setting),
  revert: (cfg) => setTuning(cfg, { batchWindowMs: 0 }),
}];

const readState = (cfg) => readJson(tuningFiles(cfg).state, { active: null, settled: {} });
const writeState = (cfg, state) => writeFileSync(tuningFiles(cfg).state, JSON.stringify(state));
const log = logCorrection;

function evaluate(cfg, state, samples, now) {
  const a = state.active;
  const after = samples.filter((s) => s.at > a.startedAt);
  if (after.length < a.baselineJobs) return [];
  const afterMs = mean(after.map((s) => s.turnaroundMs));
  const decision = afterMs < a.baselineMs ? 'kept' : 'reverted';
  if (decision === 'reverted') LEVERS.find((l) => l.id === a.lever).revert(cfg);
  state.settled[a.lever] = { decision, samples: samples.length, jobs: a.baselineJobs };
  state.active = null;
  const event = { lever: a.lever, decision, beforeMs: a.baselineMs, afterMs, jobs: after.length };
  log(cfg, { ts: new Date(now).toISOString(), ...event });
  return [event];
}

function start(cfg, state, samples, now, windowMs) {
  const top = profile(samples, { now, windowMs }).byKind[PHASE][0];
  const baseline = samples.filter((s) => s.at > now - windowMs && s.at <= now);
  if (!top || !baseline.length) return [];
  for (const lever of LEVERS) {
    const settled = state.settled[lever.id];
    if (top.key !== lever.key || (settled && (settled.decision === 'kept' || samples.length - settled.samples < settled.jobs))) continue;
    const setting = lever.plan(cfg, baseline);
    if (!setting) continue;
    lever.apply(cfg, setting);
    state.active = { lever: lever.id, startedAt: now, baselineMs: mean(baseline.map((s) => s.turnaroundMs)), baselineJobs: baseline.length, setting };
    log(cfg, { ts: new Date(now).toISOString(), lever: lever.id, decision: 'applied', setting, beforeMs: state.active.baselineMs, jobs: baseline.length });
    return [{ lever: lever.id, decision: 'applied', beforeMs: state.active.baselineMs, jobs: baseline.length }];
  }
  return [];
}

export function selfCorrect(cfg, { now = Date.now(), windowMs = DEFAULT_WINDOW_MS, samples = laneSamples(cfg) } = {}) {
  const state = readState(cfg);
  const events = state.active ? evaluate(cfg, state, samples, now) : start(cfg, state, samples, now, windowMs);
  if (events.length) writeState(cfg, state);
  const tuned = refreshBaselineBudget(cfg, samples.filter((s) => s.at > now - windowMs && s.at <= now), now);
  return tuned ? [...events, tuned] : events;
}

export function correctingIds(cfg) {
  const state = readState(cfg);
  const levers = LEVERS.filter((l) => state.active?.lever === l.id || state.settled[l.id]?.decision === 'kept');
  return levers.map((l) => blockerId({ project: basename(cfg.root), lane: laneName(cfg), kind: l.kind, key: l.key }));
}
