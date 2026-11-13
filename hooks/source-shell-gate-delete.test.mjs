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

  // A relative path belongs to the directory the `cd` segments before it reach, never to where the command ends (KIT-T1156).
  mkdirSync(join(repo, 'sub', '.ai'), { recursive: true });
  execFileSync('git', ['init', '-q'], { cwd: join(repo, 'sub') });
  const elsewhere = mkdtempSync(join(tmpdir(), 'kit-shelldel-away-'));
  check('rm of an owned file before a cd into another repo passes', !blocked(rmBy('rm mine.rs && cd sub && git status --short', 'S1')));
  check('rm of an owned file before a cd into another repo passes, absolute cd', !blocked(rmBy(`rm -f mine.rs && cd ${join(repo, 'sub').replace(/\\/g, '/')} && git status`, 'S1')));
  check('rm after the cd is judged in the cd directory: no such file there', blocked(rmBy('cd sub && rm mine.rs', 'S1')));
  check('tracked source before a cd stays blocked', blocked(rmBy('rm tracked.rs && cd sub && git status', 'S1')));
  check("another writer's file before a cd stays blocked", blocked(rmBy('rm theirs.rs && cd sub && git status', 'S1')));
  check('a write into the repo before a cd out of it stays blocked', blocked(rmBy(`echo x > fresh.rs && cd ${elsewhere.replace(/\\/g, '/')}`, 'S1')));
  check('a write after the cd out of the repo is outside it', !blocked(rmBy(`cd ${elsewhere.replace(/\\/g, '/')} && echo x > fresh.rs`, 'S1')));

  // A refused delete says why and names the way out that fits (KIT-T1156).
  const said = (command, session) => rmBy(command, session).stderr;
  check('tracked: names git rm of the path', /git rm -- tracked\.rs/.test(said('rm tracked.rs', 'S1')));
  check("another writer's file: left to its writer, no shell verb", /Another session or agent wrote this file[^]*No shell verb is sanctioned/.test(said('rm theirs.rs', 'S1')));
  check('a file no tool wrote: left to its writer', /No Edit or Write of this caller left these bytes/.test(said('rm never-ledgered.rs', 'S1')));
  check('a glob: name each file', /A glob is not expanded: name each file/.test(said('rm glob-*.rs', 'S1')));
  check('a missing file: prints the resolved path and the directory at that point', new RegExp(`No such file at [^\\n]*/sub/mine\\.rs[^\\n]*in [^\\n]*/sub at this point`).test(said('cd sub && rm mine.rs', 'S1')));
  check('no session id: says the call is unattributable', /carries no session id/.test(said('rm anon.rs', '')));
  check('a refused write that is no delete prints no delete rule', !/Delete rule/.test(said('echo x > mover.rs', 'S1')));
  rmSync(elsewhere, { recursive: true, force: true });

  // A delete operand a variable supplies is judged by the literal the command assigns it, or refused (KIT-T1162).
  check('a variable naming tracked source is blocked', blocked(rmBy('F=tracked.rs; rm "$F"', 'S1')));
  check('a variable naming another writer\'s file is blocked', blocked(rmBy('F=theirs.rs; rm "$F"', 'S1')));
  check('a variable naming a file the caller wrote passes', !blocked(rmBy('F=mine.rs; rm "$F"', 'S1')));
  check('a variable behind && and a flag is still resolved', blocked(rmBy('F=theirs.rs && rm -f "$F"', 'S1')));
  check('a variable in a directory part resolves', blocked(rmBy('D=sub; rm "$D/../theirs.rs"', 'S1')));
  check('PowerShell: a variable naming tracked source is blocked', blocked(rmBy("$f = 'tracked.rs'; Remove-Item $f", 'S1', '', 'PowerShell')));
  check('PowerShell: a variable naming a file the caller wrote passes', !blocked(rmBy("$f = 'mine.rs'; Remove-Item $f", 'S1', '', 'PowerShell')));
  check('an unassigned variable operand is blocked', blocked(rmBy('rm "$UNSET"', 'S1')));
  check('a loop variable operand is blocked', blocked(rmBy('for f in a b; do rm "$f"; done', 'S1')));
  check('a command substitution operand is blocked', blocked(rmBy('rm $(git ls-files -o)', 'S1')));
  check('a backtick substitution operand is blocked', blocked(rmBy('rm `git ls-files -o`', 'S1')));
  check('a variable assigned twice is unresolved and blocked', blocked(rmBy('F=mine.rs; F=theirs.rs; rm "$F"', 'S1')));
  check('control: a variable only in the directory part of a non-source name passes', !blocked(rmBy('rm -rf "$SCRATCH/out"', 'S1')));
  check('control: a variable naming a scratch directory with a literal file passes outside source', !blocked(rmBy('rm "$SCRATCH/a.txt"', 'S1')));
  const unresolved = said('rm "$UNSET"', 'S1');
  check('the block names the variable and the way out', /names \$UNSET[^]*NAME=value[^]*rm "\$NAME"/.test(unresolved), unresolved);
  check('the block of a substitution names it', /names \$\(\.\.\.\)/.test(said('rm $(git ls-files -o)', 'S1')));
} finally {
  rmSync(repo, { recursive: true, force: true });
  rmSync(state, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
