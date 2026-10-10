#!/usr/bin/env node
// context-budget.mjs — what a new session carries before the first prompt (KIT-T420, KIT-D089).
// Measures every SessionStart injection in tokens (~4 chars each) per registered project, prints a
// table and a total, warns over 20k and fails over 25k, and names for each oversize item the docs
// home its content moves to: ceremonial context holds pointers and hard rules; the rest is pulled
// on demand (q, code-graph, doc-trail, skills).
//
//   estimateTokens(text)                     -> token estimate
//   fileTokens(path)                         -> tokens in a file, 0 when absent
//   verdict(total)                           -> 'ok' | 'warn' | 'fail'
//   staticItems({ root, home, kit })         -> the file-backed items (global + project CLAUDE.md, MEMORY.md, SESSION.md, kit skills and agents)
//   measureProject({ name, root, ... })      -> { name, root, items, total, verdict }
//   trimAdvice(project)                      -> one line per oversize item: what to trim and its docs home
//   contextLine({ orientTokens, root })      -> the one-line orient cost, `!!` over the warn line
//   CLI: node context-budget.mjs [--project <name>] [--json] [--record]    exit 1 on fail

import { existsSync, readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readRegistry } from '../hooks/lib/registry.mjs';

export const WARN_TOKENS = 20000;
export const FAIL_TOKENS = 25000;
export const ITEM_SOFT_TOKENS = 3000;
const CHARS_PER_TOKEN = 4;
const HOOK_TIMEOUT_MS = 30000;
const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export const stampPath = () => process.env.CLAUDE_KIT_BUDGET_STAMP || join(homedir(), '.claude', 'context-budget.json');
export const estimateTokens = (text) => Math.ceil(String(text || '').length / CHARS_PER_TOKEN);

const read = (path) => {
  try { return readFileSync(path, 'utf8'); } catch { return ''; }
};
export const fileTokens = (path) => estimateTokens(read(path));

export function verdict(total) {
  return total > FAIL_TOKENS ? 'fail' : total > WARN_TOKENS ? 'warn' : 'ok';
}

const frontmatterDescription = (text) => (text.match(/^description:\s*(.+)$/m) || [])[1] || '';

function kitListings(kit) {
  const parts = [];
  for (const dir of ['skills', 'agents']) {
    let names = [];
    try { names = readdirSync(join(kit, dir)); } catch { /* absent */ }
    for (const n of names) {
      const file = dir === 'skills' ? join(kit, dir, n, 'SKILL.md') : join(kit, dir, n);
      if (existsSync(file) && file.endsWith('.md')) parts.push(`${n}: ${frontmatterDescription(read(file))}`);
    }
  }
  return parts.join('\n');
}

export function staticItems({ root, home = homedir(), kit = KIT }) {
  const encoded = resolve(root).replace(/[:\\/ ]/g, '-');
  return [
    { label: 'global CLAUDE.md', tokens: fileTokens(join(home, '.claude', 'CLAUDE.md')), counted: true },
    { label: 'project CLAUDE.md', tokens: fileTokens(join(root, 'CLAUDE.md')) + fileTokens(join(root, 'CLAUDE.local.md')), counted: true },
    { label: 'memory index', tokens: fileTokens(join(home, '.claude', 'projects', encoded, 'memory', 'MEMORY.md')), counted: true },
    { label: 'kit skill + agent listings', tokens: estimateTokens(kitListings(kit)), counted: true },
    { label: 'SESSION.md (inside orient)', tokens: fileTokens(join(root, '.ai', 'SESSION.md')), counted: false },
  ];
}

function sessionStartHooks(kit) {
  try {
    const hooks = JSON.parse(read(join(kit, 'hooks', 'hooks.json'))).hooks.SessionStart || [];
    return hooks.flatMap((e) => e.hooks.map((h) => (h.command.match(/(\S+\.mjs)\s*$/) || [])[1])).filter(Boolean);
  } catch {
    return [];
  }
}

function hookOutputTokens(kit, name, root) {
  const r = spawnSync(process.execPath, [join(kit, 'hooks', name)], {
    cwd: root, input: JSON.stringify({ hook_event_name: 'SessionStart', cwd: root }), encoding: 'utf8', timeout: HOOK_TIMEOUT_MS,
    env: { ...process.env, CLAUDE_PLUGIN_ROOT: kit },
  });
  return estimateTokens(`${r.stdout || ''}${r.stderr || ''}`);
}

export function measureProject({ name, root, home = homedir(), kit = KIT, runHooks = true }) {
  const items = staticItems({ root, home, kit });
  if (runHooks) {
    for (const hook of sessionStartHooks(kit)) items.push({ label: `${basename(hook, '.mjs')} output`, tokens: hookOutputTokens(kit, hook, root), counted: true });
  }
  const total = items.filter((i) => i.counted).reduce((n, i) => n + i.tokens, 0);
  return { name, root, items: items.sort((a, b) => b.tokens - a.tokens), total, verdict: verdict(total) };
}

const HOMES = [
  [/^global CLAUDE\.md/, 'a kit docs/<topic>.md, leaving a one-line pointer in the base CLAUDE.md source'],
  [/^project CLAUDE\.md/, 'the project docs/ tree (docs/workflow.md or a topic file), leaving a one-line pointer'],
  [/^memory index/, 'durable rules into CLAUDE.md or docs/, stale entries pruned with the maintainer (memory hygiene)'],
  [/^orient output/, 'docs/ pages the orient block points at; cut sections in hooks/orient.mjs and hooks/lib/orient-budget.mjs'],
  [/^housekeeping output/, 'fewer reminders per session (hooks/housekeeping.mjs); each due review becomes an agent dispatch'],
  [/^kit skill/, 'shorter skill and agent descriptions; detail moves into the skill body, which loads on demand'],
  [/^SESSION\.md/, 'one screen: overwrite stale state, history to the ticket or DECISIONS'],
];

export function docsHome(label) {
  const hit = HOMES.find(([re]) => re.test(label));
  return hit ? hit[1] : 'the docs tree, with a one-line pointer';
}

export function trimAdvice(project) {
  const over = project.items.filter((i) => i.tokens > ITEM_SOFT_TOKENS);
  const excess = project.total - WARN_TOKENS;
  if (project.verdict === 'ok' && !over.length) return [];
  return over.map((i) => `trim ${i.label} (${i.tokens} tokens${excess > 0 ? `, ${excess} over the ${WARN_TOKENS} warn line in total` : ''}) -> ${docsHome(i.label)}`);
}

export function contextLine({ orientTokens, root, home = homedir(), kit = KIT }) {
  const files = staticItems({ root, home, kit }).filter((i) => i.counted).reduce((n, i) => n + i.tokens, 0);
  const total = orientTokens + files;
  const mark = verdict(total) === 'ok' ? '' : '!! ';
  return `${mark}context: orient ${orientTokens} + files ${files} = ${total} tokens of ${FAIL_TOKENS} ceiling (warn ${WARN_TOKENS})${mark ? ' — node scripts/context-budget.mjs' : ''}`;
}

const SKIP_PATH = /[\\/]\.claude[\\/]worktrees[\\/]/;
export function registeredProjects(registry = readRegistry()) {
  const temp = resolve(tmpdir()).toLowerCase();
  return Object.entries(registry.projects)
    .filter(([, path]) => existsSync(path) && !SKIP_PATH.test(path) && !resolve(path).toLowerCase().startsWith(temp) && (existsSync(join(path, '.ai')) || existsSync(join(path, 'CLAUDE.md'))))
    .map(([name, path]) => ({ name, root: path }));
}

export function render(projects) {
  const lines = [];
  for (const p of projects) {
    lines.push(`${p.name}  ${p.total} tokens  ${p.verdict.toUpperCase()}`);
    for (const i of p.items) lines.push(`  ${String(i.tokens).padStart(6)}  ${i.label}${i.counted ? '' : ' (not counted)'}`);
    for (const a of trimAdvice(p)) lines.push(`  ${a}`);
  }
  return lines.join('\n');
}

export function record(projects, date = new Date().toISOString().slice(0, 10)) {
  mkdirSync(dirname(stampPath()), { recursive: true });
  writeFileSync(stampPath(), JSON.stringify({ reviewed: date, totals: Object.fromEntries(projects.map((p) => [p.name, p.total])) }, null, 2) + '\n');
}

export function lastReviewed() {
  try { return JSON.parse(read(stampPath())).reviewed || ''; } catch { return ''; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : undefined; };
  const only = arg('--project');
  const projects = registeredProjects().filter((p) => !only || p.name === only).map((p) => measureProject(p));
  if (process.argv.includes('--record')) record(projects);
  console.log(process.argv.includes('--json') ? JSON.stringify(projects, null, 2) : render(projects) || 'no registered projects');
  process.exit(projects.some((p) => p.verdict === 'fail') ? 1 : 0);
}
