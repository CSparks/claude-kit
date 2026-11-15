#!/usr/bin/env node
// hand-write-detect-incomplete.test.mjs — a snapshot git could not take names no file, so the post check refuses with a block
// that says it could not complete (KIT-T1271); an inert command, and a call whose snapshots both worked, are untouched.
// The failure is forced with a corrupt index: `git rev-parse` still finds the repository, `git status` fails.
// Run: node hooks/hand-write-detect-incomplete.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./hand-write-detect.mjs', import.meta.url));
const state = mkdtempSync(join(tmpdir(), 'kit-hwincomplete-state-'));
const repo = mkdtempSync(join(tmpdir(), 'kit-hwincomplete-'));
const env = { ...process.env, CLAUDE_KIT_TURN_STATE: state };
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};
let call = 0;
const hook = (event, command, id) => spawnSync(process.execPath, [HOOK], { cwd: repo, env, input: JSON.stringify({ session_id: 'S1', tool_use_id: id, hook_event_name: event, tool_name: 'Bash', tool_input: { command }, ...(event === 'PostToolUse' ? { tool_response: {} } : {}) }), encoding: 'utf8' });
const around = (command, breakIndexAt) => {
  const id = `call-${call++}`;
  if (breakIndexAt === 'before') writeFileSync(join(repo, '.git', 'index'), 'not an index');
  const pre = hook('PreToolUse', command, id);
  if (breakIndexAt === 'between') writeFileSync(join(repo, '.git', 'index'), 'not an index');
  return { pre, post: hook('PostToolUse', command, id) };
};
const restoreIndex = () => execFileSync('git', ['read-tree', 'HEAD'], { cwd: repo });

try {
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 't@t'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: repo });
  mkdirSync(join(repo, '.ai'), { recursive: true });
  writeFileSync(join(repo, 'a.rs'), 'fn a() {}\n');
  execFileSync('git', ['add', '.'], { cwd: repo });
  execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: repo });

  const healthy = around('node scripts/gen.mjs', '');
  check('control: both snapshots work, nothing changed, no block', healthy.pre.status === 0 && healthy.post.status === 0, healthy.post.stderr);

  const between = around('node scripts/gen.mjs', 'between');
  check('git status fails after the call: the check refuses and says it could not complete', between.post.status === 2 && /could not complete/.test(between.post.stderr), `${between.post.status} ${between.post.stderr.slice(0, 200)}`);
  restoreIndex();

  const before = around('node scripts/gen.mjs', 'before');
  check('git status fails before the call: the check refuses and says it could not complete', before.post.status === 2 && /could not complete/.test(before.post.stderr), `${before.post.status} ${before.post.stderr.slice(0, 200)}`);
  check('the pre hook itself never blocks', before.pre.status === 0);
  restoreIndex();

  const inert = around('ls -la', 'before');
  check('an inert command is untouched when the snapshot failed', inert.post.status === 0, inert.post.stderr);
  restoreIndex();
} finally {
  rmSync(repo, { recursive: true, force: true });
  rmSync(state, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
