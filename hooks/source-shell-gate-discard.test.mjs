#!/usr/bin/env node
// source-shell-gate-discard.test.mjs — `git clean`, `git rm -f`, `git stash -u`, `git checkout -- <path>`, `git restore` and
// `git reset --hard` delete, hide or overwrite files the way `rm` does, so the source gate judges them the same way
// (KIT-T1163): a named file passes only when this caller wrote it; a call that may take unnamed files, and any git call
// outside the allow-list (git-call-policy.mjs: built-in subcommand, short option and config lists, no environment change),
// passes only while no other writer is live in the checkout. A plain `git rm`, a dry run and a stash without `-u` stay allowed.
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
const stops_ps = (command) => blocked(run(command, 'S1', '', 'PowerShell'));

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
    ["git -c alias.x='clean -f' x -- theirs.rs", 'an alias given with -c that names a file'],
    ['git wipe', 'a configured alias of git clean'],
    ['git wipe2', 'an alias of an alias'],
    ['git sh anything', 'a configured shell alias'],
    ["git -c alias.y='!rm -rf' y", 'a shell alias given with -c'],
    ['git frobnicate', 'a subcommand that is no git command and no alias'],
    ["git config alias.z 'clean -fdx' && git z", 'an alias written earlier in the same command'],
    ["git config alias.st 'clean -fdx' && git st", 'a configured alias rewritten earlier in the same command'],
    ["git config --add alias.st 'clean -fdx'; git st", 'a configured alias added earlier in the same command'],
    ["git config -f other.cfg alias.st x; git st", 'an alias file written earlier in the same command'],
    ["echo '[alias]' >> .git/config; git st", 'a config file edited earlier in the same command'],
    ['git c1', 'an alias chain past the depth limit'],
    ["git --config-env=alias.st=VAR st", 'an alias taken from --config-env'],
    ["GIT_CONFIG_COUNT=1 GIT_CONFIG_KEY_0=alias.st GIT_CONFIG_VALUE_0='clean -fdx' git st", 'an alias taken from the GIT_CONFIG environment'],
    ['export GIT_CONFIG_GLOBAL=other.cfg; git st', 'an alias taken from GIT_CONFIG_GLOBAL'],
    ['git -c include.path=other.cfg st', 'an alias taken from an include'],
    ['git -c includeIf.gitdir:/.path=other.cfg st', 'an alias taken from a conditional include'],
    ['git --git-dir=.git st', 'an alias read with --git-dir'],
    ['git --work-tree=sub clean -fd', 'git clean in another work tree'],
    ['git --git-dir=.git status', 'a built-in command with --git-dir'],
    ['git --work-tree=sub status', 'a built-in command with --work-tree'],
    ['git --exec-path=/x status', 'a built-in command with --exec-path='],
    ['git --exec-path status', 'a built-in command with --exec-path'],
    ['git -c core.pager=x log', 'a core.pager key'],
    ['git -c core.fsmonitor=x status', 'a core.fsmonitor key'],
    ['git -c core.hookspath=/x commit -m x', 'a core.hooksPath key'],
    ['git -c core.sshcommand=x fetch', 'a core.sshCommand key'],
    ['git -c core.editor=x commit', 'a core.editor key'],
    ['git -c credential.helper=x fetch', 'a credential.helper key'],
    ['git --namespace=x status', 'the --namespace option'],
    ['git --attr-source=x status', 'the --attr-source option'],
    ['git --super-prefix=x status', 'the --super-prefix option'],
    ['HOME=/tmp/x git status', 'a HOME prefix'],
    ['XDG_CONFIG_HOME=/tmp/x git status', 'an XDG_CONFIG_HOME prefix'],
    ['GIT_CONFIG_NOSYSTEM=1 git status', 'a GIT_CONFIG_NOSYSTEM prefix'],
    ['GIT_EXEC_PATH=/x git status', 'a GIT_EXEC_PATH prefix'],
    ['PREFIX=/x git status', 'a PREFIX prefix'],
    ['PATH=/x:$PATH git status', 'a PATH prefix'],
    ['env PATH=/x git status', 'an env PATH prefix'],
    ['env -i git status', 'env options'],
    ['export PATH=/x; git status', 'an exported PATH'],
    ['PATH=/x; git status', 'a bare PATH assignment'],
    ['export HOME=/x && git status', 'an exported HOME'],
    ['declare -x XDG_CONFIG_HOME=/x; git status', 'a declare -x variable'],
    ['set -a; X=1; git status', 'set -a'],
    ['git checkout -f', 'git checkout -f'],
    ['git checkout .', 'git checkout of the current directory'],
    ['git checkout -- .', 'git checkout -- .'],
    ['git checkout -- sub', 'git checkout of a directory'],
    ['git checkout --pathspec-from-file=l', 'git checkout --pathspec-from-file'],
    ['git restore .', 'git restore of the current directory'],
    ['git restore -W -- sub', 'git restore of a directory'],
    ['git restore --pathspec-from-file=l', 'git restore --pathspec-from-file'],
    ['git reset --hard', 'git reset --hard'],
    ['git reset --hard HEAD~1', 'git reset --hard to a commit'],
  ];
  for (const [alias, value] of [['c1', 'c2'], ['c2', 'c3'], ['c3', 'c4'], ['c4', 'c5'], ['c5', 'clean -fd'], ['wipe', 'clean -fd'], ['wipe2', 'wipe'], ['sh', '!rm -rf'], ['st', 'status -s']]) {
    git('config', `alias.${alias}`, value);
  }
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
  check('an alias is refused even when it is harmless: the allow-list names built-ins only', stops('git st') && stops("git -c alias.z='log -1' z"));
  const everyday = ['git status --short', 'git log -1', 'git diff HEAD', 'git add .', 'git commit -m wip', 'git commit -F msg.txt', 'git push', 'git fetch', 'git show HEAD',
    'git rev-parse HEAD', 'git ls-tree HEAD', 'git ls-files', 'git mv tracked.rs moved.rs', 'git checkout -- tracked.rs', 'git checkout main', 'git checkout -b feature',
    'git submodule status', 'git submodule update --init', 'git branch', 'git config user.name x', 'git remote -v', 'git -C sub log', 'git -c core.quotepath=off status',
    'git -c user.name=t -c user.email=t@t commit -m x', 'git -c color.ui=never diff', 'git -c advice.detachedHead=false checkout main', 'git --no-pager log', 'git -P log',
    'git --no-optional-locks status', 'git restore --staged tracked.rs', 'git reset --soft HEAD~1', 'git reset', 'git ls-remote .', 'git check-ignore x', 'git notes list',
    'git -c commit.gpgsign=false commit -m x', 'git -c core.autocrlf=false add .', 'git log && git status', 'F=msg.txt; git commit -F "$F"', 'cd sub && git status'];
  for (const command of everyday) check(`control: ${command} passes beside a live writer`, passes_(command));
  check('control: a config call beside a built-in command passes', passes_('git config user.name x && git commit -m wip'));
  check('control: a git call with no subcommand runs nothing and passes', passes_('git --version') && passes_('git'));
  const blockText = run('git frobnicate', 'S1').stderr;
  check('the block of an unknown subcommand names the part and the way out', /outside the allow-list[^]*git frobnicate, which is not a built-in[^]*written plainly/.test(blockText), blockText);
  check('the block of an environment prefix names it', /HOME= in front of git/.test(run('HOME=/x git status', 'S1').stderr));
  check('the block of an option names it', /global option --git-dir=\.git/.test(run('git --git-dir=.git status', 'S1').stderr));
  check('the block of a config key names it', /git config key core\.pager given with -c/.test(run('git -c core.pager=x log', 'S1').stderr));
  check('PowerShell: an environment change before a git call is refused', stops_ps("$env:PATH = 'x'; git status"));
  check('PowerShell: a plain git call passes', !blocked(run('git status', 'S1', '', 'PowerShell')));
  check('PowerShell: a PowerShell variable is no environment change', !blocked(run("$f = 'msg.txt'; git commit -F $f", 'S1', '', 'PowerShell')));
  check('a discard of a file the caller wrote through checkout passes', passes_('git checkout -- dirty.rs', 'S1'));
  check("a checkout -- of a file with another writer's changes is blocked", stops('git checkout -- dirty.rs', 'S2'));
  check('a checkout with a revision and -- is judged the same', stops('git checkout HEAD -- dirty.rs', 'S2'));
  check('a checkout of an existing path without -- is judged the same', stops('git checkout dirty.rs', 'S2'));
  check("a restore of a file with another writer's changes is blocked", stops('git restore dirty.rs', 'S2'));
  check('a restore of the caller\'s own changes passes', passes_('git restore dirty.rs', 'S1'));
  check('a restore --source of a file with another writer\'s changes is blocked', stops('git restore --source=HEAD~1 dirty.rs', 'S2'));
  check('a restore -S -W writes the work tree and is judged', stops('git restore -S -W dirty.rs', 'S2'));
  check('control: a restore --staged touches no file and passes', passes_('git restore --staged dirty.rs', 'S2'));
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
