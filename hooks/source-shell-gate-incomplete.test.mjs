#!/usr/bin/env node
// source-shell-gate-incomplete.test.mjs — a check the gate could not complete is a refusal, never a pass (KIT-T1271): a git
// call that cannot run (no git on PATH: a spawn failure), a registry of live writers that cannot be read, or an error while
// judging a hit refuses the delete, and the block says the check could not complete. A path outside any repository still
// passes, and a command with no delete or write hit is untouched.
// Run: node hooks/source-shell-gate-incomplete.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const state = mkdtempSync(join(tmpdir(), 'kit-incomplete-state-'));
const holders = mkdtempSync(join(tmpdir(), 'kit-incomplete-holders-'));
const noGit = mkdtempSync(join(tmpdir(), 'kit-incomplete-nogit-'));
const outside = mkdtempSync(join(tmpdir(), 'kit-incomplete-outside-'));
const repo = mkdtempSync(join(tmpdir(), 'kit-incomplete-'));
process.env.CLAUDE_KIT_HOLDERS_DIR = holders;
process.env.CLAUDE_KIT_TURN_STATE = state;
const { claimFile } = await import('./lib/checkout-holder.mjs');

const hook = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const spawnGate = (command, env = process.env, cwd = repo) => spawnSync(process.execPath, [hook('source-shell-gate.mjs')], { cwd, env, input: JSON.stringify({ session_id: 'S1', tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });
const blocked = (r) => r.status === 2 && /source-shell-write/.test(r.stderr);
const incomplete = (r) => blocked(r) && /could not complete/.test(r.stderr);
const withoutGit = { ...process.env, PATH: noGit, Path: noGit };

try {
  execFileSync('git', ['init', '-q'], { cwd: repo });
  mkdirSync(join(repo, '.ai'), { recursive: true });
  writeFileSync(join(repo, 'a.rs'), 'fn a() {}\n');
  const tree = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: repo, encoding: 'utf8' }).trim();
  claimFile({ tree, session: 'S2', agent: '', label: 'other', rel: 'x.rs' });

  const noRegistry = { ...process.env, CLAUDE_KIT_HOLDERS_DIR: join(holders, 'missing') };
  for (const command of ['rm a.rs', 'git clean -f --pathspec-from-file=list.txt', 'git --attr-source=x status', 'git clean -fd']) {
    const r = spawnGate(command, withoutGit);
    check(`no git on PATH: ${command} is refused and says the check could not complete`, incomplete(r), `${r.status} ${r.stderr.slice(0, 200)}`);
  }
  const unreadable = spawnGate('git clean -fd', noRegistry);
  check('an unreadable registry of live writers refuses a sweep and says the check could not complete', incomplete(unreadable), `${unreadable.status} ${unreadable.stderr.slice(0, 200)}`);
  check('control: the same sweep with a readable registry and a live writer is refused as a sweep', blocked(spawnGate('git clean -fd')) && !/could not complete/.test(spawnGate('git clean -fd').stderr));

  mkdirSync(join(repo, 'dir'), { recursive: true });
  writeFileSync(join(repo, 'dir', 'b.rs'), 'fn b() {}\n');
  const dirDelete = spawnGate('rm -rf dir', withoutGit);
  check('no git on PATH: a directory delete is refused as a check that could not complete', incomplete(dirDelete), `${dirDelete.status} ${dirDelete.stderr.slice(0, 200)}`);
  check('a command with no delete or write hit is untouched when git is missing', spawnGate('ls -la', withoutGit).status === 0);
  writeFileSync(join(outside, 'x.rs'), 'fn x() {}\n');
  check('a delete outside any repository passes while git works', spawnGate(`rm ${join(outside, 'x.rs').replace(/\\/g, '/')}`, process.env, outside).status === 0);
} finally {
  for (const dir of [repo, state, holders, noGit, outside]) rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
