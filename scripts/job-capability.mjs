// job-capability.mjs — the per-job half of the weekly model reassessment (KIT-T419).
// The lineup refresh knows which models exist and what they cost; this module sets each
// dispatch.jobs row against the cost of its family and the outcome ledger.
//
//   jobCapabilityTable({ jobs, costs, outcomes }) -> markdown table, one row per job:
//        job | table family | cost per MTok | ledger by model (landings, tokens/landing) | proposal
//   redateRows(kitRoot, date, ids)                -> sets `evidence: <date>` on the named rows ('all' = every row)
//                                                    in the kit config; returns the ids it touched
//   CLI: node job-capability.mjs redate <date> <job,job|all>

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ladderRoot, readLadder } from './dispatch-ladder.mjs';
import { jobStats, proposals } from './dispatch-report.mjs';

export function jobCapabilityTable({ jobs, costs = {}, outcomes = [] }) {
  const stats = jobStats(outcomes);
  const open = proposals(outcomes, jobs);
  const rows = Object.entries(jobs).map(([job, row]) => {
    const cost = costs[row.family] ? `$${costs[row.family].inputPerMTok} / $${costs[row.family].outputPerMTok}` : row.family === 'local-qwen' ? 'free' : '?';
    const seen = Object.entries(stats[job] || {}).map(([m, s]) => `${m} ${s.landings}${s.failures ? `+${s.failures}f` : ''} @ ${s.tokensPerLanding ?? '-'}`).join('; ') || 'no outcomes';
    const proposal = open.filter((p) => p.job === job).map((p) => p.text).join('; ') || 'keep';
    return `| ${job} | ${row.family}${row.fallback ? ` (fallback ${row.fallback})` : ''} | ${cost} | ${seen} | ${proposal} |`;
  });
  return ['| job | table family | $in / $out per MTok | ledger by model (landings @ tokens per landing) | proposal |', '|---|---|---|---|---|', ...rows].join('\n');
}

export function redateRows(kitRoot, date, ids) {
  const file = join(kitRoot, '.ai', 'config.yml');
  const wanted = new Set(ids);
  const known = new Set(Object.keys(readLadder(kitRoot).jobs));
  const touched = [];
  let current = '';
  const lines = readFileSync(file, 'utf8').split('\n').map((line) => {
    const row = line.match(/^ {4}([\w-]+):[ \t]*$/);
    if (row) current = known.has(row[1]) ? row[1] : '';
    const stamp = line.match(/^( {6}evidence: )\d{4}-\d{2}-\d{2}(.*)$/);
    if (stamp && current && (wanted.has('all') || wanted.has(current))) {
      touched.push(current);
      return `${stamp[1]}${date}${stamp[2]}`;
    }
    return line;
  });
  writeFileSync(file, lines.join('\n'));
  return touched;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url) && process.argv[2] === 'redate') {
  console.log(`re-dated: ${redateRows(ladderRoot(), process.argv[3], String(process.argv[4] || '').split(',')).join(', ') || 'none'}`);
}
