#!/usr/bin/env node
// doc-review.mjs — the weekly documentation + directory-structure review (KIT-T281). Runs the
// doc-tree lint (scripts/doc-tree.mjs) and the structure audit (scripts/structure-audit.mjs) on
// the project and on each adopted framework's tree, and prints ONE grouped findings list for the
// maintainer to act on. `--done` records the review (silences the weekly nag for 7 days).
// Stale/undocumented-surface checks that need reading code are the doc-audit skill's job.
//
//   node scripts/doc-review.mjs [root] [--done] [--top N]

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lintDocTree } from './doc-tree.mjs';
import { auditStructure } from './structure-audit.mjs';
import { frameworkStores } from './q-framework.mjs';
import { touchDocReview } from '../hooks/lib/doc-review.mjs';
import { logReport } from './search-report.mjs';

const DEFAULT_TOP = 6;

function group(findings, top) {
  const byRule = new Map();
  for (const f of findings) byRule.set(f.rule, [...(byRule.get(f.rule) || []), f]);
  const lines = [];
  for (const [rule, list] of [...byRule].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`  ${rule} (${list.length})`);
    for (const f of list.slice(0, top)) lines.push(`    ${f.path}  ${f.msg}`);
    if (list.length > top) lines.push(`    +${list.length - top} more`);
  }
  return lines;
}

/** Report text for `root` and its adopted frameworks. */
export function reviewReport(root, top = DEFAULT_TOP) {
  const targets = [{ label: 'project', dir: root }, ...frameworkStores(root).map((f) => ({ label: `framework ${f.name}`, dir: dirname(f.aiDir) }))];
  const out = ['DOC + STRUCTURE REVIEW'];
  let total = 0;
  for (const t of targets) {
    const docs = lintDocTree(t.dir);
    const structure = auditStructure(t.dir);
    total += docs.length + structure.length;
    out.push('', `== ${t.label}: ${t.dir}`, `-- doc tree (${docs.length})`, ...group(docs, top), `-- structure (${structure.length})`, ...group(structure, top));
  }
  out.push('', logReport(root));
  out.push('', total ? `${total} finding(s). Present them grouped, ask what to act on, then: node scripts/doc-review.mjs --done` : 'Clean. Record it: node scripts/doc-review.mjs --done');
  out.push('For stale references and undocumented surface, run the doc-audit skill.');
  return out.join('\n');
}

function main(argv) {
  const ti = argv.indexOf('--top');
  const top = ti >= 0 ? Number(argv[ti + 1]) || DEFAULT_TOP : DEFAULT_TOP;
  const root = resolve(argv.filter((a, i) => !a.startsWith('--') && !(ti >= 0 && i === ti + 1))[0] || process.cwd());
  if (argv.includes('--done')) { touchDocReview(root); process.stdout.write(`recorded doc review for ${root}\n`); return 0; }
  process.stdout.write(reviewReport(root, top) + '\n');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
