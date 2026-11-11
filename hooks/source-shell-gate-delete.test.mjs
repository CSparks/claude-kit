#!/usr/bin/env node
// source-shell-gate-delete.test.mjs — a shell rm of source passes only for an untracked file this caller's own Edit or
// Write left (KIT-T1066); tracked source, another writer's file, a changed file and every non-rm write stay blocked.
// Run: node hooks/source-shell-gate-delete.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const hook = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const state = mkdtempSync(join(tmpdir(), 'kit-shelldel-state-'));
const repo = mkdtempSync(join(tmpdir(), 'kit-shelldel-'));
const env = { ...process.env, CLAUDE_KIT_TURN_STATE: state };
const spawnHook = (name, payload) => spawnSync(process.execPath, [hook(name)], { cwd: repo, env, input: JSON.stringify(payload), encoding: 'utf8' });
const who = (session, agent) => ({ ...(session ? { session_id: session } : {}), ...(agent ? { agent_id: agent } : {}) });

// A Write as the tools leave it: pre-write predicts the content, the file lands, PostToolUse confirms it.
const toolWrite = (rel, text, session, agent = '') => {
  const input = { ...who(session, agent), tool_input: { file_path: join(repo, rel), content: text } };
  spawnHook('pre-write.mjs', input);
  writeFileSync(join(repo, rel), text);
  spawnHook('tool-write-record.mjs', { ...input, hook_event_name: 'PostToolUse', tool_response: {} });
};
const rmBy = (command, session, agent = '', tool = 'Bash') => spawnHook('source-shell-gate.mjs', { ...who(session, agent), tool_name: tool, tool_input: { command } });
const blocked = (r) => r.status === 2 && /source-shell-write/.test(r.stderr);

try {
  execFileSync('git', ['init', '-q'], { cwd: repo });
  execFileSync('git', ['config', 'user.email', 't@t'], { cwd: repo });
  execFileSync('git', ['config', 'user.name', 't'], { cwd: repo });
  mkdirSync(join(repo, '.ai'), { recursive: true });
  writeFileSync(join(repo, 'tracked.rs'), 'fn tracked() {}\n');
  execFileSync('git', ['add', 'tracked.rs'], { cwd: repo });
  execFileSync('git', ['commit', '-q', '-m', 'seed'], { cwd: repo });

  toolWrite('mine.rs', 'fn mine() {}\n', 'S1');
  check('an untracked file the caller wrote is deleted by rm', !blocked(rmBy('rm mine.rs', 'S1')));
  check('rm -f of it passes too', !blocked(rmBy('rm -f mine.rs', 'S1')));
  check('PowerShell Remove-Item of it passes', !blocked(rmBy('Remove-Item mine.rs', 'S1', '', 'PowerShell')));

  toolWrite('tracked.rs', 'fn tracked() { 1 }\n', 'S1');
  check('tracked source stays blocked even when the caller edited it', blocked(rmBy('rm tracked.rs', 'S1')));
  check('rm of an owned file beside a tracked one is blocked on the tracked operand', blocked(rmBy('rm mine.rs tracked.rs', 'S1')));

  toolWrite('theirs.rs', 'fn theirs() {}\n', 'S2');
  check('an untracked file another session wrote stays blocked', blocked(rmBy('rm theirs.rs', 'S1')));
  check('the writing session itself may delete it', !blocked(rmBy('rm theirs.rs', 'S2')));

  toolWrite('agent-a.rs', 'fn a() {}\n', 'S1', 'A');
  check('a sibling agent of the same session stays blocked', blocked(rmBy('rm agent-a.rs', 'S1', 'B')));
  check('the main thread of that session stays blocked', blocked(rmBy('rm agent-a.rs', 'S1')));
  check('the writing agent may delete it', !blocked(rmBy('rm agent-a.rs', 'S1', 'A')));

  toolWrite('shared.rs', 'fn shared() {}\n', 'S1', 'A');
  toolWrite('shared.rs', 'fn shared() {}\n', 'S1', 'B');
  check('a file both agents left identical bytes in stays blocked', blocked(rmBy('rm shared.rs', 'S1', 'A')));

  toolWrite('edited.rs', 'fn edited() {}\n', 'S1');
  writeFileSync(join(repo, 'edited.rs'), 'fn edited() { changed() }\n');
  check('a file changed since the tool left it stays blocked', blocked(rmBy('rm edited.rs', 'S1')));

  toolWrite('anon.rs', 'fn anon() {}\n', '');
  check('a caller without a session id is blocked', blocked(rmBy('rm anon.rs', '')));

  writeFileSync(join(repo, 'never-ledgered.rs'), 'fn n() {}\n');
  check('an untracked file no tool wrote is blocked', blocked(rmBy('rm never-ledgered.rs', 'S1')));

  toolWrite('glob-a.rs', 'fn a() {}\n', 'S1');
  check('a glob operand is blocked', blocked(rmBy('rm glob-*.rs', 'S1')));

  toolWrite('mover.rs', 'fn m() {}\n', 'S1');
  check('mv of an owned file onto source stays blocked', blocked(rmBy('mv mover.rs other.rs', 'S1')));
  check('a redirect into an owned file stays blocked', blocked(rmBy('echo x > mover.rs', 'S1')));
  check('node unlinkSync of an owned file stays blocked', blocked(rmBy(`node -e "require('fs').unlinkSync('mover.rs')"`, 'S1')));
  check('sed -i on an owned file stays blocked', blocked(rmBy("sed -i 's/a/b/' mover.rs", 'S1')));
} finally {
  rmSync(repo, { recursive: true, force: true });
  rmSync(state, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
