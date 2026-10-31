// timing-tick.mjs — the cadence that turns the profile into action (KIT-D121). Once per `everyMs` the daemon:
//   1. lets every lane's controller apply, keep or revert its levers (timing-correct.mjs);
//   2. ranks the current blockers, waste first, and files each top one as a kit ticket or comments the new rank on
//      its open ticket; a blocker a lever is applied to or kept for is not ticketed;
//   3. comments "left the top" on the tickets of blockers that dropped out.
// Nothing here stops, kills or refuses a job: a long job is data, waste is the target.
//
//   timingTick(rootCfg, { now, everyMs, windowMs, topN, fileBug, comment }) -> { events, filed, left } | null (not due)
//   NO_FILING_ENV                                  -> set by the testkit: a fixture never files into the real kit store

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { commentKitBug, fileKitBug } from '../kit-bug.mjs';
import { brokerPaths, laneConfigs, withLane } from './config.mjs';
import { correctingIds, selfCorrect } from './timing-correct.mjs';
import { DEFAULT_TOP, DEFAULT_WINDOW_MS, blockerId, profile } from './timing-profile.mjs';
import { checkoutSamples, describe } from './timing-report.mjs';

export const NO_FILING_ENV = 'CLAUDE_KIT_NO_BUG_FILING';
export const TICK_EVERY_MS = 3600000;

const stateFile = (cfg) => join(brokerPaths(withLane(cfg, null)).home, 'blockers.json');
const readState = (cfg) => { try { return JSON.parse(readFileSync(stateFile(cfg), 'utf8')); } catch { return { at: 0, filed: {} }; } };
const quiet = () => null;
const shapeOf = (row) => `broker-blocker:${blockerId(row)}`;

export function timingTick(rootCfg, { now = Date.now(), everyMs = TICK_EVERY_MS, windowMs = DEFAULT_WINDOW_MS, topN = DEFAULT_TOP, fileBug, comment } = {}) {
  const filing = !process.env[NO_FILING_ENV];
  const post = fileBug || (filing ? fileKitBug : quiet);
  const note = comment || (filing ? commentKitBug : quiet);
  const state = readState(rootCfg);
  if (now - state.at < everyMs) return null;
  const lanes = laneConfigs(withLane(rootCfg, null));
  const events = lanes.flatMap((lane) => selfCorrect(lane, { now, windowMs }));
  const skip = new Set(lanes.flatMap(correctingIds));
  const top = profile(checkoutSamples(rootCfg), { now, windowMs, topN }).top.filter((row) => !skip.has(blockerId(row)));
  const filed = {};
  for (const row of top) {
    const made = post({ shape: shapeOf(row), title: `broker time sink: ${row.kind} ${row.key} in ${row.project}/${row.lane}`, detail: describe(row), project: row.project });
    filed[shapeOf(row)] = { id: made?.id || '', rank: row.rank, kind: row.kind, project: row.project };
  }
  const left = Object.entries(state.filed).filter(([shape]) => !filed[shape]);
  for (const [shape, prev] of left) note({ shape, text: `no longer a top blocker (was #${prev.rank}): improved, corrected or gone quiet`, project: prev.project });
  writeFileSync(stateFile(rootCfg), JSON.stringify({ at: now, filed }));
  return { events, filed: Object.keys(filed), left: left.map(([shape]) => shape) };
}
