#!/usr/bin/env node
// comment-sweep.mjs — repo sweep for comment prose (KIT-T283): the worst files by comment lines,
// the longest comment blocks, and every discussion-narrating comment, ready to become cleanup
// tickets. Same scanner as the pre-write comment gate (hooks/lib/comment-scan.mjs).
//
//   node scripts/comment-sweep.mjs [root] [--top N] [--json]

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { walkTree, isSource, extOf } from './tree-walk.mjs';
import { commentRuns, narrationHits, commentStats } from '../hooks/lib/comment-scan.mjs';

const DEFAULT_TOP = 15;
const RATIO_PRECISION = 100;

/** { files: [{path, comment, ratio, longest}], blocks: [{path, start, length}], narration: [{path, line, why}] } */
export function sweepComments(root) {
  const files = [];
  const blocks = [];
  const narration = [];
  for (const [dir, e] of walkTree(root)) {
    for (const name of e.files.filter(isSource)) {
      const path = dir ? `${dir}/${name}` : name;
      let src;
      try { src = readFileSync(join(root, path), 'utf8'); } catch { continue; }
      const ext = extOf(name);
      const s = commentStats(src, ext);
      if (s.comment) files.push({ path, comment: s.comment, ratio: Math.round(s.ratio * RATIO_PRECISION) / RATIO_PRECISION, longest: s.longest });
      for (const r of commentRuns(src, ext)) blocks.push({ path, start: r.start, length: r.length });
      for (const h of narrationHits(src, ext)) narration.push({ path, line: h.line, why: h.why });
    }
  }
  files.sort((a, b) => b.comment - a.comment || a.path.localeCompare(b.path));
  blocks.sort((a, b) => b.length - a.length || a.path.localeCompare(b.path));
  return { files, blocks, narration };
}

function main(argv) {
  const ti = argv.indexOf('--top');
  const top = ti >= 0 ? Number(argv[ti + 1]) || DEFAULT_TOP : DEFAULT_TOP;
  const positional = argv.filter((a, i) => !a.startsWith('--') && !(ti >= 0 && i === ti + 1));
  const root = resolve(positional[0] || process.cwd());
  const r = sweepComments(root);
  if (argv.includes('--json')) { process.stdout.write(JSON.stringify(r, null, 2) + '\n'); return 0; }
  const out = [`Worst files by comment lines (top ${top}):`];
  for (const f of r.files.slice(0, top)) out.push(`  ${f.comment}  ratio ${f.ratio}  longest ${f.longest}  ${f.path}`);
  out.push('', `Longest comment blocks (top ${top}):`);
  for (const b of r.blocks.slice(0, top)) out.push(`  ${b.length} lines  ${b.path}:${b.start}`);
  out.push('', `Narrating comments: ${r.narration.length}`);
  for (const n of r.narration.slice(0, top)) out.push(`  ${n.path}:${n.line}  ${n.why}`);
  process.stdout.write(out.join('\n') + '\n');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
