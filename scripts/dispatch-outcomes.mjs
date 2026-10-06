// dispatch-outcomes.mjs — what delegations cost, per family and job (KIT-D080). Reads the agent
// roster (.ai/agents.jsonl) of one or more repos and summarises the rows that carry an outcome:
// the second input, beside the research refresh, to the kit capability table.
//
//   summarizeOutcomes(rows)          -> [{ family, job, runs, done, avgDurationS, avgTokens, avgToolCalls }]
//   familyOf(model)                  -> sonnet | opus | haiku | fable | local-qwen | the raw value | 'unknown'
//   CLI: node dispatch-outcomes.mjs [--root <repo>]... [--json]    (default root: the current repo)

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readAgents } from '../hooks/lib/agent-roster.mjs';
import { gitRoot } from '../hooks/lib/paths.mjs';

const FAMILY_IN_ID = /(?:^|[^a-z])(opus|sonnet|haiku|fable)(?![a-z])/i;

export function familyOf(model) {
  const value = String(model || '').trim().toLowerCase();
  if (!value) return 'unknown';
  if (value.startsWith('local-qwen') || value.startsWith('qwen')) return 'local-qwen';
  const m = value.match(FAMILY_IN_ID);
  return m ? m[1] : value;
}

const average = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);

// Group by family (resolved model wins over the dispatch alias) and job (`[job: x]` token, else
// the agent type). Only finished or outcome-bearing rows carry cost figures; averages skip absent ones.
export function summarizeOutcomes(rows) {
  const groups = new Map();
  for (const r of rows) {
    const family = familyOf(r.resolvedModel || r.model);
    const job = r.job || r.scope || 'unknown';
    const key = `${family}\t${job}`;
    if (!groups.has(key)) groups.set(key, { family, job, rows: [] });
    groups.get(key).rows.push(r);
  }
  return [...groups.values()]
    .map(({ family, job, rows: g }) => {
      const nums = (field) => g.map((r) => r[field]).filter((v) => typeof v === 'number');
      const seconds = nums('durationMs').map((ms) => ms / 1000);
      return {
        family,
        job,
        runs: g.length,
        done: g.filter((r) => r.status === 'done').length,
        avgDurationS: average(seconds),
        avgTokens: average(nums('tokens')),
        avgToolCalls: average(nums('toolCalls')),
      };
    })
    .sort((a, b) => a.family.localeCompare(b.family) || a.job.localeCompare(b.job));
}

function renderTable(summary) {
  const head = ['family', 'job', 'runs', 'done', 'avg s', 'avg tokens', 'avg tools'];
  const cell = (v) => (v === null ? '-' : String(v));
  const rows = summary.map((s) => [s.family, s.job, s.runs, s.done, s.avgDurationS, s.avgTokens, s.avgToolCalls].map(cell));
  const widths = head.map((h, i) => Math.max(h.length, ...rows.map((r) => r[i].length)));
  const line = (cols) => cols.map((c, i) => c.padEnd(widths[i])).join('  ').trimEnd();
  return [line(head), ...rows.map(line)].join('\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const roots = [];
  process.argv.forEach((a, i) => { if (a === '--root') roots.push(resolve(process.argv[i + 1])); });
  if (!roots.length) roots.push(gitRoot());
  const rows = roots.flatMap((root) => readAgents(root, Infinity));
  const summary = summarizeOutcomes(rows);
  console.log(process.argv.includes('--json') ? JSON.stringify(summary, null, 2) : summary.length ? renderTable(summary) : 'no roster rows');
}
