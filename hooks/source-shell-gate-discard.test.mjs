#!/usr/bin/env node
// source-shell-gate-discard.test.mjs — `git clean`, `git rm -f` and `git stash -u` delete or hide files the way `rm` does, so the
// source gate judges them the same way (KIT-T1163): a named file passes only when this caller wrote it; a call that may take
// unnamed files passes only while no other writer is live in the checkout. A plain `git rm`, a dry run and a stash without
// `-u` stay allowed.
// Run: node hooks/source-shell-gate-discard.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { beatHolder, claimFile } from './lib/checkout-holder.mjs';

const hook = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const state = mkdtempSync(join(tmpdir(), 'kit-gitdel-state-'));
const repo = mkdtempSync(join(tmpdir(), 'kit-gitdel-'));
const holderDirs = [];
const env = { ...process.env, CLAUDE_KIT_TURN_STATE: state };
// An empty registry of the checkout's live writers, for the hook children and this process alike.
const freshHolders = () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-gitdel-holders-'));
  holderDirs.push(dir);
  env.CLAUDE_KIT_HOLDERS_DIR = dir;
  process.env.CLAUDE_KIT_HOLDERS_DIR = dir;
};
freshHolders();
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const spawnHook = (name, payload) => spawnSync(process.execPath, [hook(name)], { cwd: repo, env, input: JSON.stringify(payload), encoding: 'utf8' });
const who = (session, agent) => ({ ...(session ? { session_id: session } : {}), ...(agent ? { agent_id: agent } : {}) });

const toolWrite = (rel, text, session, agent = '') => {
  const input = { ...who(session, agent), tool_input: { file_path: join(repo, rel), content: text } };
  spawnHook('pre-write.mjs', input);
  writeFileSync(join(repo, rel), text);
  spawnHook('tool-write-record.mjs', { ...input, hook_event_name: 'PostToolUse', tool_response: {} });
};
const run = (command, session, agent = '', tool = 'Bash') => spawnHook('source-shell-gate.mjs', { ...who(session, agent), tool_name: tool, tool_input: { command } });
const blocked = (r) => r.status === 2 && /source-shell-write/.test(r.stderr);
const passes_ = (command, session = 'S1', agent = '') => !blocked(run(command, session, agent));
const stops = (command, session = 'S1', agent = '') => blocked(run(command, session, agent));

try {
  git('init', '-q');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  mkdirSync(join(repo, '.ai'), { recursive: true });
  mkdirSync(join(repo, 'sub'), { recursive: true });
  writeFileSync(join(repo, 'sub', 'keep.txt'), 'x\n');
  for (const name of ['tracked.rs', 'dirty.rs']) writeFileSync(join(repo, name), `fn ${name.slice(0, -3)}() {}\n`);
  git('add', '.');
  git('commit', '-q', '-m', 'seed');
  const top = git('rev-parse', '--show-toplevel');

  toolWrite('mine.rs', 'fn mine() {}\n', 'S1');
  toolWrite('theirs.rs', 'fn theirs() {}\n', 'S2');
  toolWrite('dirty.rs', 'fn dirty() { 1 }\n', 'S1');
  writeFileSync(join(repo, 'never-ledgered.rs'), 'fn n() {}\n');
  writeFileSync(join(repo, 'notes.txt'), 'n\n');

  // git clean, named files: judged like rm.
  check('clean -f -- an untracked file the caller wrote passes', passes_('git clean -f -- mine.rs'));
  check('clean -f of it without -- passes', passes_('git clean -f mine.rs'));
  check("clean -f -- another writer's file is blocked", stops('git clean -f -- theirs.rs'));
  check("clean -f without -- of another writer's file is blocked", stops('git clean -f theirs.rs'));
  check('clean -f -- a file no tool wrote is blocked', stops('git clean -f -- never-ledgered.rs'));
  check('the writing session itself may clean its file', passes_('git clean -f -- theirs.rs', 'S2'));
  check('a caller without a session id is blocked', stops('git clean -f -- mine.rs', ''));
  check('clean -fx -- another writer\'s file is blocked', stops('git clean -fx -- theirs.rs'));
  check('clean names the file through -C', stops('git -C sub clean -f -- theirs.rs'));
  check('clean -n (dry run) of it passes', passes_('git clean -n -- theirs.rs'));
  check('clean -fdn (bundled dry run) passes', passes_('git clean -fdn'));
  check('clean --dry-run passes', passes_('git clean -f --dry-run -- theirs.rs'));
  check('clean -e takes a pattern, not a path', passes_("git clean -f -e '*.rs' -- mine.rs"));
  check('clean -f -- a tracked file removes nothing and passes', passes_('git clean -f -- tracked.rs'));
  check('clean -f -- a non-source file passes', passes_('git clean -f -- notes.txt'));
  check('a variable the command assigns resolves: own file passes', passes_('F=mine.rs; git clean -f -- "$F"'));
  check("a variable the command assigns resolves: another writer's file is blocked", stops('F=theirs.rs; git clean -f -- "$F"'));
  check("sudo git clean of another writer's file is blocked", stops('sudo git clean -f -- theirs.rs'));
  check("a bash -c string with git clean of another writer's file is blocked", stops('bash -c "git clean -f -- theirs.rs"'));
  check("a chained git clean of another writer's file is blocked", stops('echo ok && git clean -f -- theirs.rs'));
  check('git -c k=v clean is read past the option', stops('git -c core.x=1 clean -f -- theirs.rs'));
  check("an alias given with -c names another writer's file: blocked", stops("git -c alias.x='clean -f' x -- theirs.rs"));
  check('an alias given with -c names the caller\'s own file: passes', passes_("git -c alias.x='clean -f' x -- mine.rs"));

  // git rm: plain stays the documented way to delete a tracked file; -f is judged.
  check('plain git rm of a tracked file passes', passes_('git rm -- tracked.rs'));
  check('plain git rm of a tracked file with local changes passes (git refuses it itself)', passes_('git rm -- dirty.rs'));
  check('git rm -f of a tracked file identical to HEAD passes', passes_('git rm -f -- tracked.rs'));
  check("git rm -f of a tracked file carrying another writer's changes is blocked", stops('git rm -f -- dirty.rs', 'S2'));
  check('git rm -f of a tracked file carrying the caller\'s own changes passes', passes_('git rm -f -- dirty.rs', 'S1'));
  check('git rm --force is judged the same', stops('git rm --force -- dirty.rs', 'S2'));
  check('git rm -rf of a tracked file with changes is judged the same', stops('git rm -rf dirty.rs', 'S2'));
  check('git rm --cached -f removes no file and passes', passes_('git rm --cached -f -- dirty.rs', 'S2'));
  check('git rm -n -f is a dry run and passes', passes_('git rm -n -f -- dirty.rs', 'S2'));
  check("git rm -f of another writer's untracked file is blocked", stops('git rm -f -- theirs.rs'));

  // git stash: only the forms that take untracked files are judged.
  check('plain git stash passes', passes_('git stash'));
  check('git stash push -m passes', passes_('git stash push -m wip'));
  check('git stash pop and list pass', passes_('git stash pop') && passes_('git stash list'));
  check("git stash push -u -- another writer's file is blocked", stops('git stash push -u -- theirs.rs'));
  check('git stash push -u -- the caller\'s own file passes', passes_('git stash push -u -- mine.rs'));
  check('git stash push -u with -m names its pathspec after --', stops('git stash push -u -m wip -- theirs.rs'));

  // A call that may take unnamed files: free while the caller is the only writer, refused once another is live.
  const sweeps = [
    ['git clean -fd', 'bare git clean'],
    ['git clean -fdx', 'git clean -x'],
    ['git clean -f -- sub', 'git clean of a directory'],
    ['git clean -f -- "*.rs"', 'git clean of a glob'],
    ['git clean -f -- "$UNKNOWN"', 'git clean of an unresolved variable'],
    ['git -C sub clean -fd', 'git clean -C a directory'],
    ['git stash -u', 'git stash -u'],
    ['git stash push --include-untracked', 'git stash push --include-untracked'],
    ['git stash push -a -m wip', 'git stash push -a'],
    ['git stash push -um wip', 'git stash push -um'],
    ['git stash save -u wip', 'git stash save -u'],
    ['git rm -rf -- sub', 'git rm -rf of a directory'],
    ['git rm -f --pathspec-from-file=list.txt', 'git rm -f --pathspec-from-file='],
    ['git rm -f --pathspec-from-file list.txt', 'git rm -f --pathspec-from-file <file>'],
    ['git rm -f --pathspec-from-file=list.txt --pathspec-file-nul', 'git rm -f --pathspec-file-nul'],
    ['git stash push -u --pathspec-from-file=list.txt', 'git stash push -u --pathspec-from-file='],
    ['git stash push -u --pathspec-from-file list.txt', 'git stash push -u --pathspec-from-file <file>'],
    ['git clean -f --pathspec-from-file=list.txt', 'git clean --pathspec-from-file='],
    ["git -c alias.x='clean -fdx' x", 'an alias given with -c'],
    ["git -c alias.x='stash -u' x", 'a stash alias given with -c'],
    ['git wipe', 'a configured alias of git clean'],
    ['git wipe2', 'an alias of an alias'],
    ['git sh anything', 'a configured shell alias'],
    ["git -c alias.y='!rm -rf' y", 'a shell alias given with -c'],
  ];
  git('config', 'alias.wipe', 'clean -fd');
  git('config', 'alias.wipe2', 'wipe');
  git('config', 'alias.sh', '!rm -rf');
  git('config', 'alias.st', 'status -s');
  for (const [command, name] of sweeps) check(`${name}: passes while no other writer is live`, passes_(command));

  freshHolders();
  claimFile({ tree: top, session: 'S1', agent: 'A', label: 'self', rel: 'mine.rs', head: 'h' });
  check("the caller's own live claim is no other writer", passes_('git clean -fd', 'S1', 'A'));
  check('a writer that only ever claimed is not a second writer to itself', passes_('git stash -u', 'S1', 'A'));

  freshHolders();
  claimFile({ tree: top, session: 'S9', agent: '', label: 'other', rel: 'x.rs', head: 'h' });
  for (const [command, name] of sweeps) check(`${name}: blocked while another writer is live`, stops(command));
  const said = run('git clean -fd', 'S1').stderr;
  check('the block names the verb, the live writer and the way out', /git clean here may take files it does not name[^]*another writer is live[^]*raise it to the main thread/.test(said), said);
  check('a named file of the caller still passes beside a live writer', passes_('git clean -f -- mine.rs'));
  check('control: git rm --pathspec-from-file without -f passes beside a live writer', passes_('git rm --pathspec-from-file=list.txt'));
  check('control: git stash push --pathspec-from-file without -u passes beside a live writer', passes_('git stash push --pathspec-from-file=list.txt'));
  check('control: an alias of a harmless command passes beside a live writer', passes_('git st') && passes_("git -c alias.z='log -1' z"));
  check('control: a git command that is no alias and no built-in passes beside a live writer', passes_('git lfs ls-files'));
  check('control: a built-in git command passes without an alias lookup', passes_('git status --short'));
  check('a plain git rm still passes beside a live writer', passes_('git rm -- tracked.rs'));
  check('a plain git stash still passes beside a live writer', passes_('git stash'));
  check('a dry run still passes beside a live writer', passes_('git clean -nd'));
  check('a named non-source file still passes beside a live writer', passes_('git clean -f -- notes.txt'));
  check('a sibling agent of the same session is another writer', stops('git clean -fd', 'S9', 'B'));
  check('the main thread of that session is another writer to its agent', stops('git clean -fd', 'S9', 'A'));
  check('the live writer itself is no other writer', passes_('git clean -fd', 'S9', ''));

  freshHolders();
  beatHolder({ tree: top, session: 'S5-held', label: 'holder' });
  check('a live holder of another session counts too', stops('git clean -fd', 'S5'));
  check('a holder is no other writer to itself', passes_('git clean -fd', 'S5-held'));

  // An ambiguous line that runs a discard is refused like any ambiguous write; one that does not, passes.
  freshHolders();
  check('an ambiguous quoting line with git clean is blocked', stops("echo it's; git clean -fd"));
  check('an ambiguous quoting line with git stash -u is blocked', stops("echo it's; git stash -u"));
  check('control: an ambiguous quoting line with a plain git stash passes', passes_("echo it's; git stash"));
} finally {
  rmSync(repo, { recursive: true, force: true });
  rmSync(state, { recursive: true, force: true });
  for (const dir of holderDirs) rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
