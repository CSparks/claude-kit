// agents.mjs — delegated work in orientation: the in-flight roster with each agent's running build (KIT-T014, KIT-T178),
// every live agent on the machine (KIT-T461), orphan background shells (KIT-T455) and the broker's lands (KIT-T276).
// Each part is best-effort.
//
// A retired agent that left a Handoff block on a ticket still open, with no dispatch since, is listed with its handoff
// (KIT-T718): "a fresh agent takes over" dispatches nothing.
//
//   agentsSection(ctx)

import { AGENT_STALE_MS, partitionAgents, projectAiDirs, readAgents } from '../../lib.mjs';
import { handoffLines, pendingSuccessors } from '../successor.mjs';
import { formatProgress, progressFor, readProgress } from '../../progress-store.mjs';
import { formatAgentLine, statusOnlyAgents, unlabelledAgents } from '../agent-format.mjs';
import { liveAgentLines, liveAgents, terminalAgentIds } from '../live-agents.mjs';
import { ORPHAN_AGE_MIN, excludedIds, orphanLines, orphanShells, projectSlug } from '../../orphan-shells.mjs';
import { CODEX, LINE_MAX, clip } from './common.mjs';

const UNLABELLED_SHOWN = 5;
const MS_PER_MIN = 60000;
const FINISHED_SHOWN = 2;

function rosterSection({ out, root }) {
  try {
    const roster = readAgents(root);
    const now = Date.now();
    const live = readProgress(root, now);
    const { inFlight, finished, stale } = partitionAgents(roster);
    const staleIds = new Set(stale.map((r) => r.id));
    const joined = new Set();
    if (!(inFlight.length || finished.length || live.length)) return;
    out.push('');
    out.push('--- In-flight agents (DELEGATED work — reattach or reconcile) ---');
    const staleMin = Math.round(AGENT_STALE_MS / MS_PER_MIN);
    const unlabelled = unlabelledAgents(roster);
    if (unlabelled.length) out.push(`!! ${unlabelled.length} agent row(s) carry no model (KIT-T403): ${unlabelled.slice(0, UNLABELLED_SHOWN).map((r) => r.id).join(', ')} — shown as [model?]`);
    const statusOnly = statusOnlyAgents(roster).length;
    if (statusOnly) out.push(`  (${statusOnly} status-only row(s): stops and reconciles with no dispatch recorded - not dispatches, not counted above)`);
    const lineOf = (r) => formatAgentLine(r, { nowMs: now, clipTask: (t) => clip(t, LINE_MAX) });
    for (const r of inFlight) {
      const running = progressFor(live, r.id);
      if (running) joined.add(running);
      // An agent mid-compile is BUSY, not uncollected: the live line outranks the age heuristic (KIT-T178).
      const reattach = CODEX ? '/agents or the agent output' : 'TaskList/output';
      const flag = staleIds.has(r.id) && !running ? ` !! UNCOLLECTED (>${staleMin}m, no completion recorded — reattach via ${reattach} or reconcile)` : '';
      const busy = running ? ` — running: ${formatProgress(running, now)}` : '';
      out.push(lineOf(r) + busy + flag);
    }
    for (const r of finished.slice(-FINISHED_SHOWN)) out.push(lineOf(r) + ' (collect output if not merged)');
    // A live build whose delegation has no roster row yet: PostToolUse(Task) fires when the result lands, so a
    // synchronous agent is mid-build for its whole life before its dispatch row is written (KIT-T177).
    for (const row of live) {
      if (!joined.has(row)) out.push(`  [running]   ${row.key} — ${formatProgress(row, now)} in ${row.repo || root} (no dispatch row yet)`);
    }
  } catch {
    /* roster unavailable — orientation proceeds without the in-flight-agent view */
  }
}

function successorSection({ out, root }) {
  try {
    const pending = pendingSuccessors(root, readAgents(root));
    if (!pending.length) return;
    out.push('', '--- RETIRED AGENT, OPEN WORK, NO SUCCESSOR (dispatch a fresh agent citing the ticket; KIT-T718) ---');
    for (const { row, ticket } of pending) {
      out.push(`  ${ticket}: ${row.id} (${row.scope || '?'}) retired with a Handoff; no dispatch has cited ${ticket} since`);
      for (const line of handoffLines(root, ticket, row.id)) out.push(`    ${clip(line, LINE_MAX)}`);
    }
  } catch {
    /* successor view is best-effort */
  }
}

export async function agentsSection(ctx) {
  const { out, root } = ctx;
  rosterSection(ctx);
  successorSection(ctx);
  try {
    const live = liveAgents({ terminalIds: terminalAgentIds(projectAiDirs().map((p) => p.aiDir)) });
    const lines = liveAgentLines(live);
    if (lines.length) out.push('', ...lines);
  } catch {
    /* cross-session agent view is best-effort */
  }
  try {
    const orphans = orphanShells({ project: projectSlug(root), minAgeMin: ORPHAN_AGE_MIN, skip: excludedIds(root) });
    if (orphans.length) out.push('', '--- In-flight agents: ORPHAN background shells (stop them with TaskStop) ---', ...orphanLines(orphans).map((l) => '  ' + l.replace('ORPHAN SHELLS:', 'ORPHAN')));
  } catch {
    /* orphan-shell scan is best-effort */
  }
  try {
    const { brokerLines } = await import('../../../scripts/broker/summary.mjs');
    const lines = brokerLines(root);
    if (lines.length) out.push('', ...lines);
  } catch {
    /* broker summary is best-effort — orientation proceeds without it */
  }
}
