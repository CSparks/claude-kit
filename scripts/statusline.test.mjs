#!/usr/bin/env node
// Tests for the agent-panel row command (scripts/statusline.mjs): live agents get a `<Model N.M> <label>` row,
// ended agents get none, and the command reads stdin and the project's roster end to end.

import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { renderAgentRows } from './statusline.mjs';

const SELF_DIR = dirname(fileURLToPath(import.meta.url));
const NOW = Date.parse('2026-11-25T12:10:00Z');
const FOUR_MIN_AGO = NOW - 4 * 60000;

let pass = 0;
let fail = 0;
const ok = (name, cond, detail = '') => { if (cond) { pass++; console.log('  ok    ' + name); } else { fail++; console.log('  FAIL  ' + name + (detail ? ' - ' + detail : '')); } };

const rosterRows = [
  { id: 'a1', status: 'in-flight', task: 'town switch', modelLabel: 'Opus 5.5', scope: 'claude-kit:implementer' },
  { id: 'a2', status: 'in-flight', task: '[Sonnet 5.5] roads curb', modelLabel: 'Sonnet 5.5', scope: 'claude-kit:implementer' },
];
const tasks = [
  { id: 'a1', status: 'running', description: '[Opus 5.5] town switch', label: 'reading planner.rs', startTime: FOUR_MIN_AGO, model: 'claude-opus-5-5' },
  { id: 'a2', status: 'running', description: 'roads curb', label: 'roads curb', startTime: FOUR_MIN_AGO },
  { id: 'a3', status: 'completed', description: 'old job', label: 'done', startTime: FOUR_MIN_AGO, model: 'claude-haiku-4-5' },
  { id: 'a4', status: 'running', description: '[Fable 1] unrostered', label: 'planning', startTime: FOUR_MIN_AGO, model: 'claude-fable-1' },
];

console.log('rendering');
const rows = renderAgentRows({ tasks, columns: 100 }, rosterRows, NOW);
const byId = Object.fromEntries(rows.map((r) => [r.id, r.content]));
ok('a live agent reads "<Model N.M> <label>  <age>  <activity>"', byId.a1 === 'Opus 5.5 town switch  4m  reading planner.rs', byId.a1);
ok('the roster supplies the model and a stored tag is stripped from the label', byId.a2 === 'Sonnet 5.5 roads curb  4m', byId.a2);
ok('an agent the roster does not hold falls back to the panel task fields', byId.a4 === 'Fable 1 unrostered  4m  planning', byId.a4);
ok('an ended agent is left out', byId.a3 === undefined && rows.length === 3);

console.log('width');
const narrow = renderAgentRows({ tasks: [tasks[0]], columns: 30 }, rosterRows, NOW)[0].content;
ok('a row never exceeds the panel width', narrow.length <= 30, narrow);
ok('a narrow row keeps the model and label ahead of the activity', narrow.startsWith('Opus 5.5 town switch'), narrow);

console.log('command');
const dir = mkdtempSync(join(tmpdir(), 'kit-statusline-'));
try {
  mkdirSync(join(dir, '.ai'), { recursive: true });
  writeFileSync(join(dir, '.ai', 'config.yml'), 'key: TST\n');
  writeFileSync(join(dir, '.ai', 'agents.jsonl'), rosterRows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const stdin = JSON.stringify({ columns: 100, cwd: dir, tasks: tasks.map((t) => ({ ...t, startTime: Date.now() - 5 * 60000, cwd: dir })) });
  const run = spawnSync(process.execPath, [join(SELF_DIR, 'statusline.mjs')], { input: stdin, encoding: 'utf8' });
  const lines = run.stdout.split('\n').filter(Boolean).map((l) => JSON.parse(l));
  ok('the command exits clean', run.status === 0, run.stderr);
  ok('it prints one id/content line per live agent', lines.length === 3 && lines.every((l) => typeof l.id === 'string' && typeof l.content === 'string'), run.stdout);
  ok('its first row names the model and label from the roster', lines[0] && lines[0].id === 'a1' && lines[0].content.startsWith('Opus 5.5 town switch  5m'), JSON.stringify(lines[0]));
  const bad = spawnSync(process.execPath, [join(SELF_DIR, 'statusline.mjs')], { input: 'not json', encoding: 'utf8' });
  ok('unreadable stdin prints nothing and exits clean', bad.status === 0 && bad.stdout === '', bad.stderr);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
