// select.mjs — choose the test files one run executes inside a wall-clock budget (KIT-D104: no routine
// operation over 5 minutes). The full suite is hours of recorded test time, so a run takes the files a
// change reaches first and fills the rest of the budget with the files run longest ago; repeated runs
// rotate through the whole suite.
//
//   reach(root, tests, changed)      -> Map<test, distance>: 0 a changed test or the test named for a changed
//                                        module, 1 a test that imports or names it, 2+ through importers
//   planRun({ tests, reached, times, ranAt, budgetMs, workers }) -> { run, deferred, estimateMs }
//   changedFiles(root, { since, env }) -> paths changed: KIT_TEST_CHANGED (newline list), else since..HEAD
//                                        plus the working tree

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, posix } from 'node:path';

const UNKNOWN_MS = 30_000;
const SOURCE = /\.(?:mjs|cjs|js)$/;
const IMPORT = /(?:from\s*|import\s*\(?\s*|require\s*\(\s*)['"](\.{1,2}\/[^'"]+)['"]/g;
const MENTION = /[\w.-]+\.(?:mjs|cjs|js)\b/g;

const NEUTRAL_DIR = /^(?:\.ai|docs|research|\.claude-plugin)\//;
const BUILD_DIR = /^(?:target|\.cache|node_modules)\//;
const sh = (cwd, args) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 26 }).split('\0').filter(Boolean);

function sources(root) {
  try { return sh(root, ['ls-files', '-z', '--', '*.mjs', '*.cjs', '*.js']); } catch { return []; }
}

function resolveImport(from, spec, known) {
  const base = posix.normalize(posix.join(dirname(from), spec));
  return [base, `${base}.mjs`, `${base}.js`, posix.join(base, 'index.mjs')].find((c) => known.has(c)) || null;
}

export function changedFiles(root, { since = null, env = process.env } = {}) {
  if (env.KIT_TEST_CHANGED !== undefined) return env.KIT_TEST_CHANGED.split(/\r?\n/).filter(Boolean);
  try {
    const out = new Set(since ? sh(root, ['diff', '--name-only', '-z', since, 'HEAD']) : []);
    for (const p of sh(root, ['diff', '--name-only', '-z', 'HEAD'])) out.add(p);
    for (const p of sh(root, ['ls-files', '-z', '--others', '--exclude-standard'])) out.add(p);
    return [...out].filter((p) => !BUILD_DIR.test(p));
  } catch { return []; }
}

// Distance from the changed files to each test through the reverse import graph; a test that names a
// changed file's basename as a string (it spawns the script) counts as an importer.
export function reach(root, tests, changed) {
  const files = sources(root);
  const known = new Set(files);
  const text = new Map(files.map((f) => [f, existsSync(join(root, f)) ? readFileSync(join(root, f), 'utf8') : '']));
  const importers = new Map();
  const add = (to, from) => importers.set(to, (importers.get(to) || new Set()).add(from));
  const byName = new Map();
  for (const f of files) byName.set(basename(f), [...(byName.get(basename(f)) || []), f]);
  for (const [from, body] of text) {
    for (const m of body.matchAll(IMPORT)) { const to = resolveImport(from, m[1], known); if (to) add(to, from); }
    if (from.endsWith('.test.mjs')) for (const name of new Set(body.match(MENTION) || [])) for (const to of byName.get(name) || []) if (to !== from) add(to, from);
  }
  const dist = new Map();
  let frontier = [];
  for (const raw of changed) {
    const path = posix.normalize(raw.split(String.fromCharCode(92)).join('/'));
    if (NEUTRAL_DIR.test(path) && !SOURCE.test(path)) continue;
    dist.set(path, 0);
    frontier.push(path);
    const stem = path.replace(/\.mjs$/, '');
    for (const t of tests) if (t === `${stem}.test.mjs` || t.startsWith(`${stem}-`) && t.endsWith('.test.mjs')) dist.set(t, 0);
    if (!SOURCE.test(path)) for (const f of files) if (f.endsWith('.test.mjs') && text.get(f).includes(basename(path)) && !dist.has(f)) dist.set(f, 1);
  }
  for (let d = 1; frontier.length; d++) {
    const next = [];
    for (const f of frontier) for (const imp of importers.get(f) || []) if (!dist.has(imp)) { dist.set(imp, d); next.push(imp); }
    frontier = next;
  }
  return new Map(tests.filter((t) => dist.has(t)).map((t) => [t, dist.get(t)]));
}

export function planRun({ tests, reached, times, ranAt = {}, budgetMs, workers }) {
  const cost = (t) => times[t] ?? UNKNOWN_MS;
  const order = [
    ...tests.filter((t) => reached.has(t)).sort((a, b) => reached.get(a) - reached.get(b) || cost(a) - cost(b)),
    ...tests.filter((t) => !reached.has(t)).sort((a, b) => (ranAt[a] ?? 0) - (ranAt[b] ?? 0) || cost(a) - cost(b)),
  ];
  const lanes = Array.from({ length: Math.max(1, workers) }, () => 0);
  const run = [];
  for (const t of order) {
    const lane = lanes.indexOf(Math.min(...lanes));
    if (reached.get(t) !== 0 && lanes[lane] + cost(t) > budgetMs && run.length) continue;
    lanes[lane] += cost(t);
    run.push(t);
  }
  const chosen = new Set(run);
  return { run, deferred: order.filter((t) => !chosen.has(t)), estimateMs: Math.max(...lanes) };
}
