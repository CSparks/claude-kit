// timing-tick.mjs — the cadence that turns the profile into action (KIT-D121). Once per `everyMs` the daemon:
//   1. lets every lane's controller apply, keep or revert its levers (timing-correct.mjs);
//   2. ranks the current blockers, waste first, and writes each lane's ranking into that lane's ONE rolling ticket
//      ("time sinks: <project>/<lane>", updated in place, owned by the kit agent's queue); a blocker a lever is
//      applied to or kept for is not listed, nor one whose per-job cost is under a twentieth of the lane's typical
//      job (profile.isMaterial: a ranking of seconds is not work). A blocker someone started fixing has its own
//      ticket (shape broker-blocker:<id>); the tick comments its new rank there but never opens one;
//   3. comments "left the top" on the own tickets of blockers that dropped out.
// Nothing here stops, kills or refuses a job: a long job is data, waste is the target.
//
//   timingTick(rootCfg, { now, everyMs, windowMs, topN, roll, comment }) -> { events, filed, left, lanes } | null (not due)
//   NO_FILING_ENV                                  -> set by the testkit: a fixture never files into the real kit store
//   materialSinks(rootCfg, lanes, { now, windowMs, topN }) -> the ranked rows worth listing (no lever working on them, material)
//   laneShape(project, lane)                     -> the dedup shape of a lane's rolling ticket

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { commentKitBug } from '../kit-bug.mjs';
import { rollKitQueueTicket } from '../kit-queue-ticket.mjs';
import { brokerPaths, laneConfigs, withLane } from './config.mjs';
import { correctingIds, selfCorrect } from './timing-correct.mjs';
import { DEFAULT_TOP, DEFAULT_WINDOW_MS, blockerId, isMaterial, profile } from './timing-profile.mjs';
import { checkoutSamples, describe } from './timing-report.mjs';

export const NO_FILING_ENV = 'CLAUDE_KIT_NO_BUG_FILING';
export const TICK_EVERY_MS = 3600000;

const stateFile = (cfg) => join(brokerPaths(withLane(cfg, null)).home, 'blockers.json');
const readState = (cfg) => { try { return JSON.parse(readFileSync(stateFile(cfg), 'utf8')); } catch { return { at: 0, filed: {} }; } };
const quiet = () => null;
const shapeOf = (row) => `broker-blocker:${blockerId(row)}`;
export const laneShape = (project, lane) => `broker-sinks:${project}/${lane}`;

export function laneBody(project, lane, rows) {
  const ranked = rows.length ? rows.map((row, i) => `${i + 1}. ${describe(row)}`) : ['no material time sink in the window.'];
  return [
    `Ranked time sinks for ${project}/${lane}, waste first (rewritten each tick):`,
    ...ranked,
    '',
    `A sink gets its own ticket only when someone starts fixing it: file it with shape ${shapeOf({ project, lane, kind: '<kind>', key: '<key>' })}; the tick then comments its rank there.`,
  ].join('\n');
}

const byLane = (rows) => rows.reduce((m, row) => m.set(`${row.project}|${row.lane}`, [...(m.get(`${row.project}|${row.lane}`) || []), row]), new Map());

export function materialSinks(rootCfg, lanes, { now, windowMs, topN }) {
  const skip = new Set(lanes.flatMap(correctingIds));
  return profile(checkoutSamples(rootCfg), { now, windowMs, topN }).top.filter((row) => !skip.has(blockerId(row)) && isMaterial(row));
}

export function timingTick(rootCfg, { now = Date.now(), everyMs = TICK_EVERY_MS, windowMs = DEFAULT_WINDOW_MS, topN = DEFAULT_TOP, roll, comment } = {}) {
  const filing = !process.env[NO_FILING_ENV];
  const post = roll || (filing ? rollKitQueueTicket : quiet);
  const note = comment || (filing ? commentKitBug : quiet);
  const state = readState(rootCfg);
  if (now - state.at < everyMs) return null;
  const lanes = laneConfigs(withLane(rootCfg, null));
  const events = lanes.flatMap((lane) => selfCorrect(lane, { now, windowMs }));
  const top = materialSinks(rootCfg, lanes, { now, windowMs, topN });
  const laneRows = byLane(top);
  const rolled = { ...(state.lanes || {}) };
  for (const key of new Set([...laneRows.keys(), ...Object.keys(rolled)])) {
    const [project, lane] = key.split('|');
    const rows = laneRows.get(key) || [];
    const made = post({ shape: laneShape(project, lane), title: `time sinks: ${project}/${lane}`, detail: laneBody(project, lane, rows), project, create: rows.length > 0 });
    rolled[key] = made?.id || rolled[key] || '';
  }
  const filed = {};
  for (const row of top) {
    const shape = shapeOf(row);
    filed[shape] = { rank: row.rank, kind: row.kind, project: row.project, trend: row.trend };
    const prev = state.filed[shape];
    if (prev && (prev.rank !== row.rank || prev.trend !== row.trend)) note({ shape, text: describe(row), project: row.project });
  }
  const left = Object.entries(state.filed).filter(([shape]) => !filed[shape]);
  for (const [shape, prev] of left) note({ shape, text: `no longer a top blocker (was #${prev.rank}): improved, corrected or gone quiet`, project: prev.project });
  writeFileSync(stateFile(rootCfg), JSON.stringify({ at: now, filed, lanes: rolled }));
  return { events, filed: Object.keys(filed), left: left.map(([shape]) => shape), lanes: rolled };
}
