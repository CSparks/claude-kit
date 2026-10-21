// capability-research.mjs — the evidence half of the capability gate (KIT-T433, KIT-D088).
// A weekly reassessment is only real when it researched what each model can do for each job. The
// research note `research/models-capability-<date>.md` must hold a table with a `Job` column and a
// `Basis` column naming a graded source (A = Anthropic, B = named hands-on, C = aggregator, M = the
// maintainer's quoted decision) for EVERY dispatch.jobs row. A later table row for the same job
// replaces an earlier one. Without one, the refresh fails and no row can be re-dated.
//
//   capabilityNotePath(kitRoot, date)         -> absolute path of the dated note
//   parseCapabilityNote(text)                 -> { job: basisText } from the note's job table
//   isGraded(basis)                           -> true when the basis cites an A, B or C source, or an M decision that carries its date
//   decisionBasis({ by, on, quote })          -> the `M (<by> <on>: "<quote>")` Basis text of a maintainer decision
//   recordDecisionRow(kitRoot, date, row)     -> path of the note with the job's M row appended (note created if absent)
//   capabilityCoverage(kitRoot, date, jobs?)  -> { file, exists, covered[], missing[] } for the given job ids (default: every row)

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readLadder } from './dispatch-ladder.mjs';

const SOURCE_GRADE = /\b[ABC]\b/;
const DECISION_GRADE = /\bM\b[^|]*\d{4}-\d{2}-\d{2}/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NEWLINES = /[|\r\n]+/g;
const TABLE_HEAD = '| Job | Basis |\n|---|---|\n';
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

export const isGraded = (basis) => SOURCE_GRADE.test(String(basis || '')) || DECISION_GRADE.test(String(basis || ''));

export function decisionBasis({ by, on, quote }) {
  if (!by || !DATE.test(String(on))) throw new Error('a maintainer decision needs --by <who> and --on <YYYY-MM-DD>');
  const words = String(quote || '').replace(NEWLINES, ' ').trim();
  if (!words) throw new Error('a maintainer decision needs --quote "<his words>"');
  return `M (${by} ${on}: "${words}")`;
}

export function recordDecisionRow(kitRoot, date, { job, by, on, quote }) {
  const row = `| ${job} | ${decisionBasis({ by, on, quote })} |\n`;
  const file = capabilityNotePath(kitRoot, date);
  mkdirSync(join(kitRoot, 'research'), { recursive: true });
  const head = `# Models capability: maintainer decisions (${date})\n\nRows below rest on the maintainer's quoted decision (grade M), not on source evidence. A later row for the same job replaces an earlier one.\n\n${TABLE_HEAD}`;
  const text = existsSync(file) ? readFileSync(file, 'utf8') : head;
  const hasTable = /\|\s*Basis\s*\|/i.test(text);
  writeFileSync(file, `${text.endsWith('\n') ? text : `${text}\n`}${hasTable ? '' : `\n${TABLE_HEAD}`}${row}`);
  return file;
}

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
