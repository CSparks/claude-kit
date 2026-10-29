// lessons.mjs — a framework's lessons ledger (KIT-T690): the solved problems every consumer must not re-hit.
// A framework doc names its ledger with `lessons: <path from the consumer root>`; orient prints the ledger's
// headings and the dispatch gate asks rendering/perf/asset/streaming briefs to cite the lessons they apply.
//
//   lessonsFile(root, framework)            -> the ledger's absolute path, or null when absent
//   lessonIds(file)                         -> Set of ids (`L-R01`) the ledger defines
//   lessonHeadings(file)                    -> section and lesson headings, status tags stripped
//   lessonsSection(root, framework)         -> the orient block lines, [] when the repo has no ledger
//   ledgerFiles(root, frameworks)           -> every ledger path found for the frameworks a repo uses

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ID = /^###\s+(L-[A-Z]\d+)\b/;
const HEADING = /^(##|###)\s+/;
const STATUS_TAG = /\s*\[[^\]]*\]\s*$/;
const HEADING_CAP = 60;

export function lessonsFile(root, framework) {
  if (!framework || !framework.lessons) return null;
  const file = join(root, framework.lessons);
  return existsSync(file) ? file : null;
}

const lines = (file) => { try { return readFileSync(file, 'utf8').split(/\r?\n/); } catch { return []; } };

export function lessonIds(file) {
  const ids = new Set();
  for (const l of lines(file)) { const m = ID.exec(l); if (m) ids.add(m[1]); }
  return ids;
}

export function lessonHeadings(file) {
  return lines(file).filter((l) => HEADING.test(l)).map((l) => l.replace(/^#+\s+/, '').replace(STATUS_TAG, '').trim()).slice(0, HEADING_CAP);
}

export function lessonsSection(root, framework) {
  const file = lessonsFile(root, framework);
  if (!file) return [];
  return [
    `--- FRAMEWORK LESSONS: ${framework.name} (${framework.lessons}; solved problems, read before rendering, perf, asset, streaming or crate-structure work; cite them as [lessons-checked: L-R01, …]) ---`,
    ...lessonHeadings(file).map((h) => `  ${h}`),
    '',
  ];
}

export function ledgerFiles(root, frameworks) {
  return frameworks.map((f) => lessonsFile(root, f)).filter(Boolean);
}
