// The ONE formatter for an agent-roster row (KIT-T403). Every surface that lists agents prints
// the model FIRST: `[Opus 5.5] general-purpose  a38e4bdc  in-flight 46m  <task>`. A row with no
// model prints `[model?]` — never a blank path.

import { modelDisplay } from '../model-tag.mjs';
import { ceilingFlag } from './agent-context.mjs';

export const MODEL_UNKNOWN = '[model?]';

export function modelTag(row) {
  const display = modelDisplay(row && row.model);
  return display ? `[${display}]` : MODEL_UNKNOWN;
}

function ageText(row, nowMs) {
  const t = Date.parse((row && (row.firstSeen || row.ts)) || '');
  if (!Number.isFinite(t)) return '';
  const min = Math.max(0, Math.round((nowMs - t) / 60000));
  return min >= 60 ? ` ${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}m` : ` ${min}m`;
}

// `clipTask` shortens the label to the caller's line budget; `nowMs` is injectable for tests.
export function formatAgentLine(row, { nowMs = Date.now(), clipTask = (s) => s, indent = '  ' } = {}) {
  const task = clipTask(row.task || row.summary || '?');
  const status = `${row.status || 'in-flight'}${row.reason && row.status === 'killed' ? `: ${row.reason}` : ''}`;
  const wip = Array.isArray(row.wip) && row.wip.length ? `  WIP: ${row.wip.join(', ')}` : '';
  return `${indent}${modelTag(row)} ${row.scope || '?'}  ${row.id}  ${status}${ageText(row, nowMs)}${row.background ? ' bg' : ''}  ${task}${wip}${ceilingFlag(row)}`;
}

// A DISPATCH row carries the brief's task; a row with only id/status/source is a status update
// (SubagentStop, a reconcile mark) for an agent whose dispatch this roster never recorded.
export const isDispatchRow = (r) => Boolean(r && String(r.task || '').trim());

// Dispatch rows the lint must flag: no model recorded. Status-only rows are never dispatches.
export const unlabelledAgents = (rows) => rows.filter((r) => isDispatchRow(r) && !String(r.model || '').trim());

// Status-only rows: counted separately so they never read as unlabelled dispatches.
export const statusOnlyAgents = (rows) => rows.filter((r) => r && !isDispatchRow(r));
