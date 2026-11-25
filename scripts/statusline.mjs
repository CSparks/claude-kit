#!/usr/bin/env node
// statusline.mjs - the kit's per-agent row for Claude Code's agent panel (the list under the prompt).
// The plugin's settings.json names it as `subagentStatusLine`; Claude Code runs it about every 5 s and
// writes `{ columns, tasks: [{ id, agentType, status, description, label, startTime, model, cwd }] }` on
// stdin. It prints one `{"id","content"}` line per live agent, and the panel shows `content` as the row:
//   Opus 5.5 town switch  4m  reading planner.rs
// An agent that has ended gets no line, so its row keeps Claude Code's own text.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isMain } from './is-main.mjs';
import { storeRoot } from '../hooks/lib/paths.mjs';
import { readAgents } from '../hooks/lib/agent-roster.mjs';
import { rowModelDisplay } from '../hooks/lib/agent-format.mjs';
import { modelDisplay, stripModelTag } from '../hooks/model-tag.mjs';

const ENDED = new Set(['completed', 'done', 'failed', 'error', 'killed', 'stopped', 'cancelled', 'canceled', 'stale', 'collected', 'merged']);
const LABEL_MAX = 32;
const DEFAULT_COLUMNS = 100;
const MIN_ACTIVITY_COLUMNS = 8;
const MS_PER_MIN = 60000;
const MIN_PER_HOUR = 60;
const GAP = '  ';
const ELLIPSIS = '...';

const clip = (text, max) => (text.length <= max ? text : `${text.slice(0, Math.max(0, max - ELLIPSIS.length))}${ELLIPSIS}`);
const oneLine = (text) => String(text ?? '').replace(/\s+/g, ' ').trim();

function ageText(startTime, nowMs) {
  const t = typeof startTime === 'number' ? startTime : Date.parse(startTime || '');
  if (!Number.isFinite(t)) return '';
  const min = Math.max(0, Math.round((nowMs - t) / MS_PER_MIN));
  return min >= MIN_PER_HOUR ? `${Math.floor(min / MIN_PER_HOUR)}h${String(min % MIN_PER_HOUR).padStart(2, '0')}m` : `${min}m`;
}

// The roster row for a panel task: the roster keeps the model label and task text the dispatch recorded.
export function rosterRowFor(rows, task) {
  return (rows || []).find((r) => r.id === task.id);
}

// One panel row: `<Model N.M> <short label>  <age>  <activity>`, within `columns`.
export function agentRowText(task, rosterRow, { columns = DEFAULT_COLUMNS, nowMs = Date.now() } = {}) {
  const model = (rosterRow && (rosterRow.modelLabel || rowModelDisplay(rosterRow))) || modelDisplay(task.model) || 'model?';
  const named = oneLine(stripModelTag((rosterRow && rosterRow.task) || task.description || task.agentType || 'agent'));
  const head = `${model} ${clip(named, LABEL_MAX)}`;
  const age = ageText(task.startTime, nowMs);
  const activity = oneLine(task.label);
  const lead = [head, age].filter(Boolean).join(GAP);
  const room = columns - lead.length - GAP.length;
  const tail = activity && activity !== oneLine(task.description) && room >= MIN_ACTIVITY_COLUMNS ? `${GAP}${clip(activity, room)}` : '';
  return clip(`${lead}${tail}`, columns);
}

// The rows to print: one `{ id, content }` per task that has not ended.
export function renderAgentRows({ tasks = [], columns = DEFAULT_COLUMNS }, rosterRows = [], nowMs = Date.now()) {
  return tasks
    .filter((t) => t && t.id && !ENDED.has(String(t.status || '').toLowerCase()))
    .map((t) => ({ id: t.id, content: agentRowText(t, rosterRowFor(rosterRows, t), { columns, nowMs }) }));
}

function readRoster(input) {
  const start = (input.tasks || []).map((t) => t.cwd).find(Boolean) || input.cwd || process.cwd();
  const root = storeRoot(resolve(start));
  return root ? readAgents(root, undefined, { reconcile: false }) : [];
}

function main() {
  let input;
  try { input = JSON.parse(readFileSync(0, 'utf8')); } catch { return; }
  let roster = [];
  try { roster = readRoster(input); } catch { /* the stdin fields still name the model and label */ }
  for (const row of renderAgentRows(input, roster)) process.stdout.write(`${JSON.stringify(row)}\n`);
}

if (isMain(import.meta.url)) main();
