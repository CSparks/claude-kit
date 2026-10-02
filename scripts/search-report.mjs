#!/usr/bin/env node
// search-report.mjs — how much searching goes through the indexes (q, code-graph) versus raw
// grep (KIT-T285). Source: the per-project search log (hooks/search-telemetry.mjs), or, with
// --transcripts, a scan of the project's Claude Code transcripts (tool_use blocks, subagents
// included) classified by the SAME classifier — that is how BASELINE was measured.
//
//   node scripts/search-report.mjs [root] [--days N] [--transcripts [--dir <transcript dir>]]

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyCalls } from '../hooks/lib/search-shape.mjs';
import { readSearchLog } from '../hooks/lib/search-log.mjs';

export const DEFAULT_DAYS = 14;
const TOP = 8;
const PATTERN_SHOWN = 80;
const PERCENT = 100;
const MS_PER_DAY = 86400000;
const BLOCK_TEXT = /BLOCKED: (?:searching the \.ai work store|grepping the source tree)/g;

// Reference counts from a 14-day scan of the stiletto transcripts (321 sessions, subagents included).
export const BASELINE = {
  label: 'stiletto, scanned at ticket time',
  q: 198, qFts: 96, codeGraph: 9, grep: 6924, grepRustWgsl: 4181, grepTool: 976, gateBlocks: 267,
};

const WALKED_LANGS = new Set(['rust', 'wgsl', 'glsl']);

/** Aggregate rows [{ kind, verb, lang, target, shape, pattern, event }] into counts. */
export function usageSummary(rows) {
  const s = { q: 0, qFts: 0, codeGraph: 0, grep: 0, grepRustWgsl: 0, grepTool: 0, glob: 0, find: 0, gateBlocks: 0, shapes: new Map(), patterns: new Map() };
  for (const r of rows) {
    if (r.event === 'blocked') { s.gateBlocks++; continue; }
    if (r.kind === 'q') { s.q++; if (r.verb === 'fts') s.qFts++; }
    else if (r.kind === 'code-graph') s.codeGraph++;
    else if (r.kind === 'grep' || r.kind === 'rg' || r.kind === 'Grep') {
      if (r.kind === 'Grep') s.grepTool++; else s.grep++;
      if (WALKED_LANGS.has(r.lang)) s.grepRustWgsl++;
      if (r.target === 'code') {
        const key = `${r.shape || 'regex'}:${r.lang || 'any'}`;
        s.shapes.set(key, (s.shapes.get(key) || 0) + 1);
        if (r.pattern) s.patterns.set(r.pattern, (s.patterns.get(r.pattern) || 0) + 1);
      }
    } else if (r.kind === 'Glob') s.glob++;
    else if (r.kind === 'find') s.find++;
  }
  return s;
}

const top = (m) => [...m].sort((a, b) => b[1] - a[1]).slice(0, TOP);
const sharePct = (indexed, raw) => (indexed + raw ? Math.round((PERCENT * indexed) / (indexed + raw)) : 0);

export function formatSummary(s, source, days) {
  const b = BASELINE;
  return [
    `SEARCH USAGE (${days}d, ${source})`,
    `  indexed: q ${s.q} (fts ${s.qFts}), code-graph ${s.codeGraph}`,
    `  raw: grep/rg ${s.grep} (Rust/WGSL-filtered ${s.grepRustWgsl}), Grep tool ${s.grepTool}, Glob ${s.glob}, find ${s.find}`,
    `  indexed share of grep-or-index searches: ${sharePct(s.q + s.codeGraph, s.grep + s.grepTool)}%   gate blocks: ${s.gateBlocks}`,
    `  baseline (${b.label}): q ${b.q} (fts ${b.qFts}), code-graph ${b.codeGraph}, grep/rg ${b.grep} (Rust/WGSL ${b.grepRustWgsl}), Grep tool ${b.grepTool}, gate blocks ${b.gateBlocks} — indexed share ${sharePct(b.q + b.codeGraph, b.grep + b.grepTool)}%`,
    '  most common grep shapes with no indexed answer (shape:language):',
    ...top(s.shapes).map(([k, n]) => `    ${n}  ${k}`),
    '  top grep patterns:',
    ...top(s.patterns).map(([k, n]) => `    ${n}  ${k.slice(0, PATTERN_SHOWN)}`),
  ].join('\n');
}

function* jsonlFiles(dir) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) yield* jsonlFiles(p);
    else if (e.name.endsWith('.jsonl')) yield p;
  }
}

/** Classified rows from a transcript tree (every .jsonl, subagents included). */
export function transcriptRows(dir, days) {
  const since = Date.now() - days * MS_PER_DAY;
  const rows = [];
  for (const file of jsonlFiles(dir)) {
    try { if (statSync(file).mtimeMs < since) continue; } catch { continue; }
    for (const line of readFileSync(file, 'utf8').split('\n')) {
      if (!line.includes('tool_use') && !line.includes('BLOCKED:')) continue;
      let e;
      try { e = JSON.parse(line); } catch { continue; }
      if (e.timestamp && Date.parse(e.timestamp) < since) continue;
      const content = e.message && e.message.content;
      if (!Array.isArray(content)) continue;
      for (const b of content) {
        if (b && b.type === 'tool_use') rows.push(...classifyCalls(b.name, b.input));
        else if (b && b.type === 'tool_result') {
          const t = typeof b.content === 'string' ? b.content : JSON.stringify(b.content || '');
          for (const hit of t.matchAll(BLOCK_TEXT)) rows.push({ event: 'blocked', rule: hit[0] });
        }
      }
    }
  }
  return rows;
}

export const transcriptDirFor = (root) => join(homedir(), '.claude', 'projects', resolve(root).replace(/[:\\/ ]/g, '-'));

/** The report text for `root` from its search log. */
export function logReport(root, days = DEFAULT_DAYS) {
  return formatSummary(usageSummary(readSearchLog(root, days)), 'search log', days);
}

function main(argv) {
  const flagValue = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
  const days = Number(flagValue('--days')) || DEFAULT_DAYS;
  const skip = new Set([argv.indexOf('--days') + 1, argv.indexOf('--dir') + 1].filter((i) => i > 0));
  const pos = argv.filter((a, i) => !a.startsWith('--') && !skip.has(i));
  const root = resolve(pos[0] || process.cwd());
  if (argv.includes('--transcripts')) {
    const dir = flagValue('--dir') || transcriptDirFor(root);
    process.stdout.write(formatSummary(usageSummary(transcriptRows(dir, days)), `transcripts ${dir}`, days) + '\n');
    return 0;
  }
  process.stdout.write(logReport(root, days) + '\n');
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main(process.argv.slice(2)));
