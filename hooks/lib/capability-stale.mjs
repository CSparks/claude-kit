// capability-stale — the dispatch-guard check `capability-table-stale` (KIT-T339, KIT-T1089).
// A table older than dispatch.refresh_days, or behind a newer known model, blocks every dispatch except the
// reassessment that repairs it: a `[job: research]` brief carrying `[model-refresh: <date>]` that names
// research/models-capability-<date>.md and declares [paths:] only where the refresh writes. Two days before the
// block (STALE_WARN_LEAD_DAYS) a dispatch passes with a reminder, printed once per session.
//
//   staleBlock({ root, input, prompt, footer })   -> block message | null
//   staleWarning({ sessionId, root })             -> reminder text the first time this session sees a near-stale table, else null
//   refreshDispatch({ root, input, prompt })      -> is this dispatch the exempt reassessment
//
// Fails open: any error is "no block, no warning".

import { join } from 'node:path';
import { capabilityStatus } from '../../scripts/model-lineup.mjs';
import { ladderRoot } from '../../scripts/dispatch-ladder.mjs';
import { dispatchJob } from '../dispatch-job.mjs';
import { declaredPaths } from '../dispatch-broker.mjs';
import { TOKENS } from './gate-tokens.mjs';
import { readTurnState, writeTurnState } from './turn-state.mjs';

export const STALE_TABLE_CHECK = 'capability-table-stale';
export const REFRESH_JOB = 'research';
export const STALE_WARN_LEAD_DAYS = 2;
const WARNED_SLOT = 'capability-stale-warned';
const WRITABLE_PREFIXES = ['research/', '.ai/decisions/'];
const WRITABLE_FILES = ['.ai/config.yml', '.ai/model-lineup.json'];

const allowedPath = (p) => !p.split('/').includes('..') && (WRITABLE_PREFIXES.some((prefix) => p.startsWith(prefix)) || WRITABLE_FILES.includes(p));

export function refreshDispatch({ root, input, prompt }) {
  const tag = TOKENS.modelRefresh.pattern.exec(String(prompt || ''));
  if (!tag || dispatchJob(root, input) !== REFRESH_JOB) return false;
  if (!String(prompt).includes(`research/models-capability-${tag[1]}.md`)) return false;
  const paths = declaredPaths(prompt, ladderRoot());
  return !!paths && paths.every(allowedPath);
}

export function staleBlock({ root, input, prompt, footer }) {
  let status;
  try {
    status = capabilityStatus();
    if (!status.stale || refreshDispatch({ root, input, prompt })) return null;
  } catch {
    return null;
  }
  return [
    'BLOCKED: the model capability table is stale (KIT-T339).',
    ...status.reasons.map((r) => `  - ${r}`),
    '',
    'Dispatch routes by cost and capability per model; a stale table routes by guesswork.',
    `Fix: run the refresh — node ${join(ladderRoot(), 'scripts', 'model-refresh.mjs')} — then review the proposed`,
    'decision in .ai/decisions/ and move the aliases in .ai/config.yml dispatch.aliases if a newer model landed.',
    `The reassessment itself dispatches with ${TOKENS.modelRefresh.form}: [job: ${REFRESH_JOB}], a brief naming research/models-capability-<date>.md, [paths:] under research/ and .ai/ only.`,
    '',
    footer,
  ].join('\n');
}

export function staleWarning({ sessionId = '', root }) {
  try {
    const status = capabilityStatus();
    if (status.stale || status.ageDays === null || status.ageDays < status.refreshDays - STALE_WARN_LEAD_DAYS) return null;
    const warned = readTurnState(root, WARNED_SLOT) || {};
    const key = sessionId || 'unknown';
    if (warned[key]) return null;
    writeTurnState(root, { ...warned, [key]: Date.now() }, WARNED_SLOT);
    return [
      `capability table: WARNING: row "${status.oldestJob}" evidence ${status.asOf} is ${status.ageDays} days old; dispatches are blocked past ${status.refreshDays} (KIT-T339).`,
      `  Refresh now: dispatch the reassessment with ${TOKENS.modelRefresh.form} (q gates agent), then node ${join(ladderRoot(), 'scripts', 'model-refresh.mjs')}.`,
    ].join('\n');
  } catch {
    return null;
  }
}
