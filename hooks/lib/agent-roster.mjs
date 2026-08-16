// --- durable delegated-agent roster (KIT-T014) ----------------------------------
// KIT-D015's "/clear loses nothing" requires every class of live state to live on disk;
// in-flight BACKGROUND subagents were the last gap (a `/clear` orphaned delegated work the
// resume couldn't see). The roster is an append-only JSONL at .ai/agents.jsonl — the same
// "files are the diffable record" shape as the other stores (KIT-D024), but cheap enough to
// write per-delegation from a PostToolUse(Task) hook. Append-only + one-JSON-object-per-line
// means concurrent writers (multiple agents) can't corrupt each other's rows, and a single
// malformed line is skipped on read rather than poisoning the whole roster.
//
// Lifecycle of a row: `recordAgent` on delegation (status 'in-flight'); `updateAgent` appends
// a NEW row keyed by the same id when the agent finishes/fails (status 'done'/'error') — we
// never rewrite a prior line (append-only), so the audit trail is intact and the LATEST row
// per id wins on read. orient reads the collapsed view; an in-flight row with no terminal row,
// older than a threshold, is flagged as orphaned/uncollected.

import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

export const AGENT_ROSTER_REL = '.ai/agents.jsonl';
// An in-flight row older than this with no terminal row is "uncollected" — surfaced loudly on
// resume so delegated work can be reattached or reconciled, not silently dropped.
export const AGENT_STALE_MS = 30 * 60 * 1000; // 30 min
// Cap the roster read so a long-lived repo's history never bloats orientation; the newest rows
// are the live ones, so we scan the tail.
export const AGENT_ROSTER_TAIL = 400;

export function agentsPath(root) {
  return join(root, AGENT_ROSTER_REL);
}

// Append one row. `rec` carries at least { id, status }; we stamp `ts` (ISO) when absent.
// Best-effort + atomic-per-line (a single appendFileSync of one '\n'-terminated JSON object) —
// never throws, so a roster write can't wedge the Task tool call that triggered it.
export function recordAgent(root, rec) {
  try {
    if (!root || !rec) return;
    const row = { ts: new Date().toISOString(), ...rec };
    const p = agentsPath(root);
    mkdirSync(dirname(p), { recursive: true });
    appendFileSync(p, JSON.stringify(row) + '\n');
  } catch {
    /* roster is best-effort — never break a hook */
  }
}

// Mark an existing delegation's outcome by APPENDING a new row for the same id (append-only;
// readAgents collapses to the latest per id). `patch` typically { status, summary }.
export function updateAgent(root, id, patch) {
  if (!id) return;
  recordAgent(root, { id, ...patch });
}

// The statuses that mean an agent's life is OVER. Terminal is a RATCHET: once an id reaches one,
// no later row can move it back to a live status (see readAgents).
const AGENT_TERMINAL = new Set(['done', 'error', 'collected', 'merged']);

// Parse the roster's tail into the COLLAPSED current view: the latest row per id, with
// `firstSeen` carried from the id's earliest row so age can be measured from delegation, not
// from the last update. RECONCILE-ON-READ: rows arrive out of order — PostToolUse(Task) fires
// when the tool RESULT lands, so a synchronous agent's dispatch row is appended AFTER its own
// SubagentStop row. Later rows still enrich the fields, but a terminal status is never overridden
// by a live one, so a finished agent can't be resurrected as permanently uncollected (KIT-T228).
// FAIL-OPEN: a missing file → []; a malformed line is skipped, never thrown. Returns rows
// sorted oldest-first by firstSeen (stable render order).
export function readAgents(root) {
  let lines;
  try {
    lines = readFileSync(agentsPath(root), 'utf8').split('\n').filter(Boolean);
  } catch {
    return [];
  }
  if (lines.length > AGENT_ROSTER_TAIL) lines = lines.slice(-AGENT_ROSTER_TAIL);
  const byId = new Map();
  const firstSeen = new Map();
  for (const ln of lines) {
    let row;
    try { row = JSON.parse(ln); } catch { continue; }
    if (!row || !row.id) continue;
    if (!firstSeen.has(row.id)) firstSeen.set(row.id, row.ts || '');
    const prev = byId.get(row.id);
    const merged = { ...prev, ...row, firstSeen: firstSeen.get(row.id) };
    if (prev && AGENT_TERMINAL.has(prev.status) && !AGENT_TERMINAL.has(row.status)) {
      merged.status = prev.status;
      merged.ts = prev.ts;
      if (prev.source) merged.source = prev.source;
    }
    byId.set(row.id, merged);
  }
  return [...byId.values()].sort((a, b) => String(a.firstSeen).localeCompare(String(b.firstSeen)));
}

// Split the collapsed roster into what a resume needs to act on: still IN-FLIGHT (no terminal
// status) vs recently FINISHED (done/error), and which in-flight rows are STALE (older than
// AGENT_STALE_MS) — the uncollected/orphaned work to flag. `nowMs` is injectable for tests.
export function partitionAgents(rows, nowMs = Date.now()) {
  const inFlight = [];
  const finished = [];
  for (const r of rows) {
    if (AGENT_TERMINAL.has(r.status)) finished.push(r);
    else inFlight.push(r);
  }
  const ageMs = (r) => { const t = Date.parse(r.firstSeen || r.ts || ''); return Number.isFinite(t) ? nowMs - t : 0; };
  const stale = inFlight.filter((r) => ageMs(r) >= AGENT_STALE_MS);
  return { inFlight, finished, stale };
}
