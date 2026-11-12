// framework-first.mjs — the framework-first rule's shared parts (KIT-T1095). A framework doc names its crate index
// with `crates: <path from the consumer root>`; a plan, a plan dispatch or a design brief in a repo that uses the
// framework must cite the index rows it read before it proposes a mechanism, and orient restates the rule.
//
//   crateIndexFile(root, framework)        -> the index's absolute path, or null when the framework names none or it is absent
//   crateNames(file)                       -> Set of crate names the index lists (first backticked cell of a table row)
//   frameworkCitationOk(said, names)       -> does `said` (a [framework-checked: …] value) name an indexed crate, or `none apply: <why>`
//   frameworkFirstSection(root, framework) -> the orient block lines, [] when the repo has no index
//   frameworkFirstMessage({ subject, framework, names, said, footer }) -> the block text

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TOKENS } from './gate-tokens.mjs';

const ROW = /^\|\s*`([^`]+)`/gm;
const WORD = /[^\s,;:()[\]]+/g;
const NONE_APPLY = /^none apply\b[:\s-]*\S/i;
const EXAMPLE_CRATES = 2;

export function crateIndexFile(root, framework) {
  if (!framework || !framework.crates) return null;
  const file = join(root, framework.crates);
  return existsSync(file) ? file : null;
}

export function crateNames(file) {
  try {
    return new Set([...readFileSync(file, 'utf8').matchAll(ROW)].map((m) => m[1]));
  } catch {
    return new Set();
  }
}

export function frameworkCitationOk(said, names) {
  const value = String(said || '').trim();
  if (!value) return false;
  if (NONE_APPLY.test(value)) return true;
  if (!names.size) return true;
  return (value.match(WORD) || []).some((w) => names.has(w));
}

export function frameworkFirstSection(root, framework) {
  const file = crateIndexFile(root, framework);
  if (!file) return [];
  return [
    `--- FRAMEWORK FIRST: ${framework.name} — a need is met by ${framework.name} before the game: read ${framework.crates} (crate index) and each candidate crate's surface before proposing any mechanism, and cite them as ${TOKENS.frameworkChecked.form} on a plan, a plan dispatch or a design brief ---`,
    '',
  ];
}

export function frameworkFirstMessage({ subject, framework, names, said, footer }) {
  const examples = [...names].slice(0, EXAMPLE_CRATES).join(', ') || 'rg-…';
  return [
    `BLOCKED: this ${subject} is for a repo that uses ${framework.name}, and the framework already ships crates for most needs (${framework.crates}).`,
    said ? `  cited: "${said}" (no crate of the index named)` : '  cited: nothing',
    '',
    'Read the crate index and the surface of each candidate crate (q sym / q code --path <crate>) for EVERY mechanism the plan proposes,',
    'before designing it. A mechanism the framework has is tuned there, never rebuilt in the game; one it lacks goes into the framework first.',
    '',
    `Fix: add [framework-checked: <crate rows or surfaces read, per mechanism, e.g. ${examples}>] naming crates of the index, or`,
    '[framework-checked: none apply: <why>] when none does.',
    '',
    footer,
  ].join('\n');
}
