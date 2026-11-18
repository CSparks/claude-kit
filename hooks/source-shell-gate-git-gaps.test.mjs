#!/usr/bin/env node
// source-shell-gate-git-gaps.test.mjs — three gaps of the git allow-list round (KIT-T1172), judged by whether one agent can
// ACCIDENTALLY destroy another writer's uncommitted work: forcing forms of git calls that overwrite local changes
// (switch -f, checkout-index -f, read-tree -u --reset|-m, worktree remove --force, submodule update --force), built-in
// subcommands that run a command (rebase -x, bisect run, submodule foreach, filter-branch, difftool, mergetool,
// for-each-repo), and an export or an environment assignment placed after a quote or inside a nested runner text.
// Run: node hooks/source-shell-gate-git-gaps.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { claimFile } from './lib/checkout-holder.mjs';

const hook = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const state = mkdtempSync(join(tmpdir(), 'kit-gitgaps-state-'));
const repo = mkdtempSync(join(tmpdir(), 'kit-gitgaps-'));
const holderDirs = [];
const env = { ...process.env, CLAUDE_KIT_TURN_STATE: state };
const freshHolders = () => {
  const dir = mkdtempSync(join(tmpdir(), 'kit-gitgaps-holders-'));
  holderDirs.push(dir);
  env.CLAUDE_KIT_HOLDERS_DIR = dir;
  process.env.CLAUDE_KIT_HOLDERS_DIR = dir;
};
freshHolders();
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const spawnHook = (name, payload) => spawnSync(process.execPath, [hook(name)], { cwd: repo, env, input: JSON.stringify(payload), encoding: 'utf8' });
const toolWrite = (rel, text, session) => {
  const input = { session_id: session, tool_input: { file_path: join(repo, rel), content: text } };
  spawnHook('pre-write.mjs', input);
  writeFileSync(join(repo, rel), text);
  spawnHook('tool-write-record.mjs', { ...input, hook_event_name: 'PostToolUse', tool_response: {} });
};
const run = (command, session = 'S1') => spawnHook('source-shell-gate.mjs', { session_id: session, tool_name: 'Bash', tool_input: { command } });
const blocked = (r) => r.status === 2 && /source-shell-write/.test(r.stderr);
const passes_ = (command, session) => !blocked(run(command, session));
const stops = (command, session) => blocked(run(command, session));

const SWEEPS = [
  ['git switch -f main', 'git switch -f'],
  ['git switch --force main', 'git switch --force'],
  ['git switch --discard-changes main', 'git switch --discard-changes'],
  ['git switch -fc feature', 'git switch -fc'],
  ['git checkout-index -f -a', 'git checkout-index -f'],
  ['git checkout-index --force --all', 'git checkout-index --force'],
  ['git read-tree -u --reset HEAD', 'git read-tree -u --reset'],
  ['git read-tree -um HEAD', 'git read-tree -um'],
  ['git read-tree -u -m HEAD', 'git read-tree -u -m'],
  ['git worktree remove --force ../wt', 'git worktree remove --force'],
  ['git worktree remove -f ../wt', 'git worktree remove -f'],
  ['git worktree remove -ff ../wt', 'git worktree remove -ff'],
  ['git submodule update --force', 'git submodule update --force'],
  ['git submodule update --init -f', 'git submodule update --init -f'],
  ["git submodule foreach 'rm -f x.rs'", 'git submodule foreach'],
  ['git submodule foreach git clean -fd', 'git submodule foreach with a git discard'],
  ['git for-each-repo --config=maintenance.repo maintenance run', 'git for-each-repo'],
  ['git filter-branch --tree-filter "rm x" HEAD', 'git filter-branch'],
  ['git difftool -x "rm x" HEAD', 'git difftool -x'],
  ['git difftool --extcmd=x HEAD', 'git difftool --extcmd'],
  ['git difftool --tool=vimdiff', 'git difftool --tool'],
  ['git mergetool -t vimdiff', 'git mergetool -t'],
  ['git mergetool --tool=vimdiff', 'git mergetool --tool'],
  ['git rebase -x "$CMD" main', 'git rebase -x with a variable command'],
  ['git rebase --exec', 'git rebase --exec with no operand'],
  ['git bisect run', 'git bisect run with no command'],
  ['git bisect run $CMD', 'git bisect run with a variable command'],
  ["bash -c 'export GIT_DIR=x; git status'", 'an export after a quote'],
  ['bash -c "export GIT_DIR=x; git status"', 'an export after a double quote'],
  ['eval "export GIT_DIR=x; git status"', 'an export inside eval'],
  ['su -c "export GIT_DIR=x; git status" nobody', 'an export inside su -c'],
  ["bash -c 'PATH=/x; git status'", 'a bare PATH assignment inside bash -c'],
  ['eval "HOME=/x; git status"', 'a bare HOME assignment inside eval'],
  ["bash -c \"bash -c 'export GIT_DIR=x; git status'\"", 'an export two runners deep'],
];

try {
  git('init', '-q');
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  mkdirSync(join(repo, '.ai'), { recursive: true });
  mkdirSync(join(repo, 'sub'), { recursive: true });
  writeFileSync(join(repo, 'sub', 'keep.txt'), 'x\n');
  writeFileSync(join(repo, 'tracked.rs'), 'fn tracked() {}\n');
  git('add', '.');
  git('commit', '-q', '-m', 'seed');
  const top = git('rev-parse', '--show-toplevel');
  toolWrite('mine.rs', 'fn mine() {}\n', 'S1');
  toolWrite('theirs.rs', 'fn theirs() {}\n', 'S2');

  for (const [command, name] of SWEEPS) check(`${name}: passes while no other writer is live`, passes_(command));

  freshHolders();
  claimFile({ tree: top, session: 'S9', agent: '', label: 'other', rel: 'x.rs', head: 'h' });
  spawnHook('holder-beat.mjs', { session_id: 'S2', tool_input: { file_path: join(repo, 'theirs.rs'), content: 'fn theirs() {}\n' } });
  for (const [command, name] of SWEEPS) check(`${name}: blocked while another writer is live`, stops(command));

  const everyday = ['git status --short', 'git log -1', 'git diff HEAD', 'git add .', 'git commit -m wip', 'git push', 'git fetch', 'git show HEAD', 'git rev-parse HEAD',
    'git ls-tree HEAD', 'git ls-files', 'git mv tracked.rs moved.rs', 'git switch main', 'git switch -c feature', 'git switch -', 'git submodule update', 'git submodule update --init --recursive',
    'git submodule status', 'git checkout-index -a', 'git read-tree HEAD', 'git read-tree --reset HEAD', 'git read-tree -m HEAD', 'git worktree add ../wt', 'git worktree list',
    'git worktree remove ../wt', 'git bisect start', 'git bisect good', 'git difftool HEAD', 'git mergetool',
    'git difftool -y HEAD', 'git commit -m "export the helper"', 'git commit -m "set -a flag in the docs"', 'git log --grep=export',
    "bash -c 'git status'", "bash -c 'FOO_NOT_IN_ENV=1; git status'", 'eval "git log -1"', "bash -c 'echo hi; git diff'"];
  for (const command of everyday) check(`control: ${command} passes beside a live writer`, passes_(command));

  // A command a git call runs is judged like the same command typed alone, from the top of the work tree.
  const INNER = [
    ["git rebase -x 'rm theirs.rs' main", "rebase -x rm of another writer's file"],
    ['git rebase --exec "rm theirs.rs" main', 'rebase --exec rm'],
    ['git rebase --exec="rm theirs.rs" main', 'rebase --exec= rm'],
    ["git rebase -ix 'rm theirs.rs' main", 'rebase -ix rm'],
    ["git rebase -x 'echo x > theirs.rs' main", 'rebase -x with a redirect onto it'],
    ["git rebase -x 'cp mine.rs theirs.rs' main", 'rebase -x with a cp onto it'],
    ["git rebase -x 'git clean -f -- theirs.rs' main", 'rebase -x with a nested git clean of it'],
    ["git rebase -x 'bash -c \"rm theirs.rs\"' main", 'rebase -x with a nested bash -c'],
    ['git bisect run rm theirs.rs', 'bisect run rm'],
    ["git bisect run sh -c 'rm theirs.rs'", 'bisect run sh -c rm'],
    ["cd sub && git rebase -x 'rm theirs.rs' main", 'rebase -x from a subdirectory resolves against the work tree top'],
    ["git -C sub rebase -x 'rm theirs.rs' main", 'rebase -x with -C'],
  ];
  for (const [command, name] of INNER) check(`${name}: blocked`, stops(command));
  check("the caller's own file named by the inner command passes", passes_("git bisect run rm mine.rs", 'S1'));
  check("the writing session itself may remove its file through bisect run", passes_("git bisect run rm theirs.rs", 'S2'));
  check('an inner command that writes no source passes', passes_('git bisect run cargo test') && passes_('git bisect run make check'));
  check('an inner write to a non-source file passes', passes_("git bisect run sh -c 'echo ok > notes.txt'"));
  check('KIT-T1266: a rebase (with or without -x) is a sweep beside a live writer, whatever its inner command', stops('git rebase main') && stops('git rebase --continue') && stops('git rebase -i main')
    && stops("git rebase -x 'rm mine.rs' main", 'S1') && stops("git rebase -x 'cargo test' main"));

  // The text of a line whose quoting cannot be split is read blind: any command a git call runs is refused.
  check('an ambiguous quoting line with rebase -x is blocked', stops("echo it's; git rebase -x make main"));
  check('an ambiguous quoting line with bisect run is blocked', stops("echo it's; git bisect run make"));
  check('an ambiguous quoting line with git switch -f is blocked', stops("echo it's; git switch -f main"));
  check('an ambiguous quoting line with submodule update --force is blocked', stops("echo it's; git submodule update --force"));
  check('an export after a dollar-quote string is blocked', stops("echo $'ok'; export GIT_DIR=x; git status"));
  check('control: the same line without the export passes', passes_("echo $'ok'; git status"));
  check('KIT-T1266: an ambiguous quoting line with a plain rebase is blocked', stops("echo it's; git rebase main"));
  check('control: an ambiguous quoting line with git bisect good passes', passes_("echo it's; git bisect good"));
  check('control: an ambiguous quoting line with a plain switch passes', passes_("echo it's; git switch main"));

  const said = run('git submodule foreach git clean -fd').stderr;
  check('the block names the call that runs a command and the way out', /git submodule foreach, which runs its command inside each submodule directory[^]*written plainly/.test(said), said);
  const exportSaid = run("bash -c 'export GIT_DIR=x; git status'").stderr;
  check('the block of an export inside a runner text names it', /the environment is named in the same command[^]*run the git call as its own command/.test(exportSaid), exportSaid);

  // KIT-T1367: an export of build settings git never reads, for a program run, beside read-only git calls with a pathspec.
  const PROBE = 'export CARGO_MANIFEST_DIR="D:/dev/rg/crates/road-generator" BEVY_ASSET_ROOT="D:/dev/rg/crates/road-generator"; ./target/release/probe.exe globe';
  check('an export of CARGO_*/BEVY_* literals beside read-only git with a pathspec passes', passes_(`${PROBE}; echo "sha $(git log -1 --format=%h -- src/a.rs) dirty $(git status --short -- src | wc -l)"`));
  check('a prefix assignment of an allowed name passes', passes_('RUST_LOG=info git log -1 --format=%h -- src/a.rs'));
  check('negative: one GIT_* name in the same export keeps the refusal', stops('export CARGO_X=1 GIT_DIR=elsewhere; git status --short -- src'));
  check('negative: an allowed name set from a substitution keeps the refusal', stops('export CARGO_X="$(pwd)"; git status --short -- src'));
  check('negative: a second, plain export keeps the refusal', stops('export CARGO_X=1; export PAGER=less; git log -1 -- src/a.rs'));
  check('negative: an allowed export does not lift a real discard', stops(`${PROBE}; git clean -fd`));
  // KIT-T1373: a folder named Local (Windows temp paths) is no `local` declaration.
  check('a temp path through AppData/Local beside read-only git passes', passes_('builds --run "env RDG_SEED=1 target/release/probe.exe roads" --out "C:/Users/CHRISS~1/AppData/Local/Temp/city13.txt" --timeout 170 --tool-timeout 180 2>&1 | head -1; git log --oneline -1 | cut -c1-8'));
  check('the same path with backslashes passes', passes_('time ./probe.exe --out C:\\Users\\x\\AppData\\Local\\Temp\\a.txt; git log --oneline -1'));
  check('negative: a real local declaration before git keeps the refusal', stops('f() { local GIT_DIR=x; git status; }; f'));
  check('negative: an export whose value is such a path keeps the refusal', stops('export GIT_DIR=C:/Users/x/AppData/Local/repo; git log -1'));
  const offList = run('export PAGER=less; git log -1 --format=%h -- src/a.rs').stderr;
  check('the headline names the git call and its reason, not a hand delete', /a git call outside the allow-list may take files it does not name \([^)]*\), refused because: the environment is named in the same command \(`export`\)/.test(offList) && !/deletes a source file by hand/.test(offList), offList);
} finally {
  rmSync(repo, { recursive: true, force: true });
  rmSync(state, { recursive: true, force: true });
  for (const dir of holderDirs) rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
