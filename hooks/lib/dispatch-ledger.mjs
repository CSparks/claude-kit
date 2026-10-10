// The dispatch outcome ledger (KIT-T419): one row per finished subagent in .ai/dispatch-outcomes.jsonl,
// the evidence scripts/dispatch-report.mjs weighs the capability table against.
//
//   outcomeRow({ id, rosterRow, stop, outcome, now }) -> { ts, id, job, model, tokens, tool_uses, duration_ms, outcome }
//   appendOutcome(root, row) / readOutcomes(root)     -> append-only JSONL; a missing or corrupt file reads as []
//
// `model` is the family that ran (resolved model over the dispatch alias); `outcome` is `failed` when the
// stop payload carries an error or a failure status, else `completed`.

import { readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { familyOf } from '../../scripts/dispatch-outcomes.mjs';

export const OUTCOMES_REL = '.ai/dispatch-outcomes.jsonl';
const FAILED_STATUS = /^(fail|error|cancel|abort|timeout)/i;

export function stopOutcome(stop = {}) {
  const status = String(stop.status || stop.stop_reason || stop.reason || '');
  return stop.error || stop.success === false || FAILED_STATUS.test(status) ? 'failed' : 'completed';
}

export function outcomeRow({ id, rosterRow = {}, stop = {}, outcome = {}, now = new Date() }) {
  const row = {
    ts: now.toISOString(),
    id,
    job: rosterRow.job || '',
    model: familyOf(outcome.resolvedModel || rosterRow.resolvedModel || rosterRow.model),
    tokens: outcome.tokens ?? null,
    tool_uses: outcome.toolCalls ?? null,
    duration_ms: outcome.durationMs ?? null,
    outcome: stopOutcome(stop),
  };
  if (rosterRow.modelOverride) row.model_override = rosterRow.modelOverride;
  return row;
}

export function appendOutcome(root, row) {
  try {
    const p = join(root, OUTCOMES_REL);
    mkdirSync(dirname(p), { recursive: true });
    appendFileSync(p, JSON.stringify(row) + '\n');
  } catch {
    /* ledger is best-effort */
  }
}

export function readOutcomes(root) {
  try {
    return readFileSync(join(root, OUTCOMES_REL), 'utf8').split('\n').flatMap((line) => {
      try { return line.trim() ? [JSON.parse(line)] : []; } catch { return []; }
    });
  } catch {
    return [];
  }
}
