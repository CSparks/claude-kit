// job-capability.mjs — the per-job half of the weekly model reassessment (KIT-T419).
// The lineup refresh knows which models exist and what they cost; this module sets each
// dispatch.jobs row against the cost of its family and the outcome ledger.
//
//   jobCapabilityTable({ jobs, costs, outcomes }) -> markdown table, one row per job:
//        job | table family | cost per MTok | ledger by model (landings, tokens/landing) | proposal
//   redateRows(kitRoot, date, ids)                -> sets `evidence: <date>` on the named rows ('all' = every row)
//                                                    in the kit config; returns the ids it touched. Throws unless
//                                                    research/models-capability-<date>.md grades each named row (KIT-T433).
//   CLI: node job-capability.mjs redate <date> <job,job|all>
//        node job-capability.mjs decide <date> <job> --by <who> --on <YYYY-MM-DD> --quote "<his words>"
//          writes the job's M row (a maintainer decision with its date) into the note, then re-dates the row

import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ladderRoot, readLadder } from './dispatch-ladder.mjs';
import { jobStats, proposals } from './dispatch-report.mjs';
import { capabilityCoverage, recordDecisionRow } from './capability-research.mjs';
import { isMain } from './is-main.mjs';

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
  const named = wanted.has('all') ? [...known] : [...wanted];
  const unknown = named.filter((id) => !known.has(id));
  if (unknown.length) throw new Error(`unknown dispatch job(s): ${unknown.join(', ')}`);
  const { file: note, missing } = capabilityCoverage(kitRoot, date, named);
  if (missing.length) throw new Error(`cannot re-date without capability evidence: ${note} has no graded (A/B/C source or dated M decision) Basis for ${missing.join(', ')}; record a maintainer decision with: node job-capability.mjs decide <date> <job> --by <who> --on <date> --quote "<his words>"`);
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

if (isMain(import.meta.url) && process.argv[2] === 'redate') {
  try {
    console.log(`re-dated: ${redateRows(ladderRoot(), process.argv[3], String(process.argv[4] || '').split(',')).join(', ') || 'none'}`);
  } catch (e) {
    console.error(`redate refused: ${e.message}`);
    process.exit(1);
  }
}

if (isMain(import.meta.url) && process.argv[2] === 'decide') {
  try {
    const [date, job] = [process.argv[3], process.argv[4]];
    const flag = (name) => { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : undefined; };
    if (!date || !job) throw new Error('usage: decide <date> <job> --by <who> --on <YYYY-MM-DD> --quote "<his words>"');
    const note = recordDecisionRow(ladderRoot(), date, { job, by: flag('by'), on: flag('on'), quote: flag('quote') });
    console.log(`decision recorded in ${note}; re-dated: ${redateRows(ladderRoot(), date, [job]).join(', ') || 'none'}`);
  } catch (e) {
    console.error(`decide refused: ${e.message}`);
    process.exit(1);
  }
}
