// capability-research.mjs — the evidence half of the capability gate (KIT-T433, KIT-D088).
// A weekly reassessment is only real when it researched what each model can do for each job. The
// research note `research/models-capability-<date>.md` must hold a table with a `Job` column and a
// `Basis` column naming a graded source (A = Anthropic, B = named hands-on, C = aggregator, M = the
// maintainer's quoted decision) for EVERY dispatch.jobs row. A later table row for the same job
// replaces an earlier one. Without one, the refresh fails and no row can be re-dated.
//
//   capabilityNotePath(kitRoot, date)         -> absolute path of the dated note
//   parseCapabilityNote(text)                 -> { job: basisText } from the note's job table
//   isGraded(basis)                           -> true when the basis cites an A, B, C or M source
//   capabilityCoverage(kitRoot, date, jobs?)  -> { file, exists, covered[], missing[] } for the given job ids (default: every row)

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLadder } from './dispatch-ladder.mjs';

const GRADE = /\b[ABCM]\b/;
const cells = (line) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());

export const capabilityNotePath = (kitRoot, date) => join(kitRoot, 'research', `models-capability-${date}.md`);

export function parseCapabilityNote(text) {
  const rows = {};
  let jobCol = -1;
  let basisCol = -1;
  for (const line of String(text).split('\n')) {
    if (!line.trim().startsWith('|')) {
      jobCol = basisCol = -1;
      continue;
    }
    const parts = cells(line);
    if (jobCol < 0) {
      const lower = parts.map((c) => c.toLowerCase());
      jobCol = lower.indexOf('job');
      basisCol = lower.indexOf('basis');
      continue;
    }
    if (basisCol < 0 || /^[-: ]+$/.test(parts[jobCol] || '')) continue;
    rows[(parts[jobCol] || '').replace(/`/g, '')] = parts[basisCol] || '';
  }
  return rows;
}

export const isGraded = (basis) => GRADE.test(String(basis || ''));

export function capabilityCoverage(kitRoot, date, jobs = Object.keys(readLadder(kitRoot).jobs)) {
  const file = capabilityNotePath(kitRoot, date);
  const exists = existsSync(file);
  const rows = exists ? parseCapabilityNote(readFileSync(file, 'utf8')) : {};
  return {
    file,
    exists,
    covered: jobs.filter((j) => isGraded(rows[j])),
    missing: jobs.filter((j) => !isGraded(rows[j])),
  };
}
