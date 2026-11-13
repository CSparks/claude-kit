#!/usr/bin/env node
// move-lines.mjs — the sanctioned way to move EXISTING lines of a source file into other files (KIT-T1155).
// Source changes go through Edit and Write, which run the pre-write checks; retyping 900 lines of a split through them
// invites typos. This kit verb moves lines verbatim instead and proves it: it re-reads every file it wrote and checks
// that the lines of the source before equal the lines of the source after plus every moved line (an empty sorted line diff).
//
//   node scripts/move-lines.mjs [--append] [--dry-run] <source> <ranges>=<dest> [<ranges>=<dest> ...]
//     <ranges>  1-based inclusive line numbers of the source: `10-120`, `5`, `10-20,40-45` (kept in the order given)
//     <dest>    a file to create (parent directories are made); with --append an existing file takes the lines at its end
//     --dry-run print the plan and the counts, write nothing
//
// Refuses (move-lines/guard.mjs): a source or destination outside the git root, not a source path, behind a symlink, or a
// hook, config or settings file; a source git does not track (unless an Edit or Write tool left it as it is). Also: a
// destination that exists (without --append), overlapping ranges, a range past the end, a result over the hard
// file-length limit (hooks/lib/limits.mjs). The moved lines carry no header: add includes or imports with Edit afterwards,
// which judges the new file. The shell gates treat a call that passes the guard as a kit verb (hooks/lib/move-lines-call.mjs),
// and the accepted-writes ledger credits the files it wrote, so shell-call attribution does not blame the call for them.
// Exit 0 done, 1 refused or proof failed (every file put back).

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileLengthVerdict } from '../hooks/lib/limits.mjs';
import { isMain } from './is-main.mjs';
import { parseMoveLinesArgs } from './move-lines/args.mjs';
import { creditMove, moveLinesProblem } from './move-lines/guard.mjs';
import { joinLines, planMoves, sortedDiff, splitLines } from './move-lines/plan.mjs';

const DIFF_SHOWN = 10;

function destPlan(dest, movedLines, sourceEol, append) {
  if (!existsSync(dest)) return { dest, before: [], text: joinLines(movedLines, sourceEol, true), created: true };
  if (!append) throw new Error(`${dest} exists: pass --append to add the lines at its end`);
  const old = splitLines(readFileSync(dest, 'utf8'));
  return { dest, before: old.lines, text: joinLines([...old.lines, ...movedLines], old.eol, true), created: false };
}

function lengthProblems(plans, source, sourceLines, keptCount) {
  const entries = [...plans.map((p) => [p.dest, p.before.length, splitLines(p.text).lines.length]), [source, sourceLines, keptCount]];
  return entries.filter(([, before, after]) => fileLengthVerdict(before, after) === 'block')
    .map(([path, , after]) => `${path} would be ${after} lines, over the hard limit: split it finer`);
}

export function verify(sourceBefore, sourceAfterPath, plans, movedAll) {
  const after = splitLines(readFileSync(sourceAfterPath, 'utf8')).lines;
  const diff = sortedDiff(sourceBefore, [...after, ...movedAll]);
  if (diff.length) return `sorted line diff is not empty (${diff.length} lines): ${diff.slice(0, DIFF_SHOWN).join(' | ')}`;
  for (const p of plans) {
    const got = splitLines(readFileSync(p.dest, 'utf8')).lines;
    if (p.before.some((line, i) => got[i] !== line)) return `${p.dest}: existing lines changed`;
  }
  return '';
}

export function moveLines(argv, { out = process.stdout, err = process.stderr, cwd = process.cwd() } = {}) {
  let args;
  try { args = parseMoveLinesArgs(argv, cwd); } catch (e) { err.write(`move-lines: ${e.message}\n`); return 1; }
  const { source, specs, append, dryRun } = args;
  const problem = moveLinesProblem({ source, dests: specs.map((s) => s.dest), cwd });
  if (problem) { err.write(`move-lines: refused, nothing written: ${problem}\n`); return 1; }
  const sourceText = readFileSync(source, 'utf8');
  const { lines, eol } = splitLines(sourceText);
  let plans;
  let carve;
  try {
    if (specs.some((s) => s.dest === source)) throw new Error('a destination is the source itself');
    carve = planMoves(lines, specs);
    plans = [...carve.moved].map(([dest, moved]) => destPlan(dest, moved, eol, append));
    const problems = lengthProblems(plans, source, lines.length, carve.kept.length);
    if (problems.length) throw new Error(problems.join('\n  '));
  } catch (e) { err.write(`move-lines: refused, nothing written: ${e.message}\n`); return 1; }
  const movedAll = [...carve.moved.values()].flat();
  const summary = [`${source}: ${lines.length} -> ${carve.kept.length} lines`, ...plans.map((p) => `${p.dest}: ${p.before.length} -> ${splitLines(p.text).lines.length} lines (${p.created ? 'created' : 'appended'})`)];
  if (dryRun) { out.write(`move-lines (dry run, nothing written)\n  ${summary.join('\n  ')}\n`); return 0; }

  const originals = plans.map((p) => ({ dest: p.dest, existed: !p.created, text: p.created ? '' : readFileSync(p.dest, 'utf8') }));
  const restore = () => {
    for (const o of originals) { if (o.existed) writeFileSync(o.dest, o.text); else rmSync(o.dest, { force: true }); }
    writeFileSync(source, sourceText);
  };
  try {
    for (const p of plans) { mkdirSync(dirname(p.dest), { recursive: true }); writeFileSync(p.dest, p.text); }
    writeFileSync(source, joinLines(carve.kept, eol, sourceText.endsWith('\n')));
    const failure = verify(lines, source, plans, movedAll);
    if (failure) { restore(); err.write(`move-lines: verbatim proof failed, every file put back: ${failure}\n`); return 1; }
  } catch (e) { restore(); err.write(`move-lines: ${e.message}; every file put back\n`); return 1; }
  creditMove({ files: [source, ...plans.map((p) => p.dest)], cwd });
  out.write(`move-lines: moved ${movedAll.length} lines verbatim\n  ${summary.join('\n  ')}\n  proof: sorted line diff of the source before against the source after plus the moved lines is empty (${lines.length} lines)\n`);
  return 0;
}

if (isMain(import.meta.url)) process.exit(moveLines(process.argv.slice(2)));
