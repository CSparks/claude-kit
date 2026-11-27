// live-roster — the roster rows of a project whose agent still runs (KIT-T1611; the liveness test dispatch-guard used
// alone before, KIT-T177, KIT-T1356).
//
//   liveRosterRows(root, nowMs?) -> the collapsed roster's in-flight rows (lib/agent-roster.mjs readAgents, which
//                                   reconciles dead agents) younger than LIVE_ROW_WINDOW_MS whose agent the harness
//                                   did not stop (lib/subagent-transcript.mjs stoppedByHarness)
//
// An in-flight row older than the window is treated as abandoned: the harness cannot always report a background agent's
// completion, so an uncollected row would otherwise read as live forever. A row whose agent died with no trace still
// counts until the window ages it out. FAIL-OPEN: a missing or corrupt roster yields no rows.

import { partitionAgents, readAgents } from './agent-roster.mjs';
import { stoppedByHarness } from './subagent-transcript.mjs';

export const LIVE_ROW_WINDOW_MS = 2 * 60 * 60 * 1000;

export function liveRosterRows(root, nowMs = Date.now()) {
  try {
    const { inFlight } = partitionAgents(readAgents(root), nowMs);
    return inFlight.filter((r) => {
      const t = Date.parse(r.firstSeen || r.ts || '');
      return Number.isFinite(t) && nowMs - t < LIVE_ROW_WINDOW_MS && !stoppedByHarness(r);
    });
  } catch {
    return [];
  }
}
