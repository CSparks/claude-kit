// git-integration-guard.test.mjs — a pull, a rebase and a stash move every writer's tracked changes out of the shared work tree,
// whatever the git configuration says (KIT-T1266: an autostash by one agent took 24 files of five agents). Beside a live writer the
// source-shell gate refuses `git pull`, `git rebase` and `git stash` (push, save, bare); any `--autostash` (pull, rebase, merge) is
// refused whether or not another writer is live. fetch, push, a plain merge and the stash actions that only read or restore pass.
// Run: node hooks/git-integration-guard.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'kit-gitint-state-'));
const { claimFile } = await import('./lib/checkout-holder.mjs');

const gate = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
let fails = 0;
const check = (name, cond) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`); if (!cond) fails++; };

function checkout({ liveWriter }) {
  const holders = mkdtempSync(join(tmpdir(), 'kit-gitint-holders-'));
  process.env.CLAUDE_KIT_HOLDERS_DIR = holders;
  const repo = mkdtempSync(join(tmpdir(), 'kit-gitint-'));
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
  git('init', '-q');
  mkdirSync(join(repo, '.ai'), { recursive: true });
  git('config', 'user.email', 't@t');
  git('config', 'user.name', 't');
  git('commit', '-q', '--allow-empty', '-m', 'seed');
  if (liveWriter) claimFile({ tree: git('rev-parse', '--show-toplevel'), session: 'S9', agent: 'roads', label: 'roads agent', rel: 'x.rs', head: 'h' });
  return (command) => spawnSync(process.execPath, [gate], { cwd: repo, env: { ...process.env, CLAUDE_KIT_HOLDERS_DIR: holders }, encoding: 'utf8', input: JSON.stringify({ session_id: 'S1', tool_name: 'Bash', tool_input: { command } }) });
}
const refused = (r) => r.status === 2 && /source-shell-write/.test(r.stderr);

const beside = checkout({ liveWriter: true });
const alone = checkout({ liveWriter: false });
const stops = (commands, run = beside) => commands.filter((c) => !refused(run(c)));
const passes = (commands, run = beside) => commands.filter((c) => refused(run(c)));
const report = (name, wrong) => { check(name, wrong.length === 0); wrong.forEach((c) => console.log(`        ${c}`)); };

const INCIDENT = 'cd /d/dev/road-generator/rapid-game && P="rust/a.rs"; git commit -F msg.txt -- $P > g.txt 2>&1; git pull --rebase --autostash origin main >> g.txt 2>&1; git push origin HEAD:main >> g.txt 2>&1';
report('the incident command (a pull --rebase --autostash in a shared checkout) is refused', stops([INCIDENT]));
report('a pull is refused beside a live writer, whatever its flags (the configuration may add the rebase and the autostash)', stops([
  'git pull', 'git pull origin main', 'git pull --ff-only', 'git pull --rebase', 'git pull --rebase origin main', 'git pull --no-rebase', 'git -C rapid-game pull', 'cd sub && git pull origin main',
  'git -c pull.rebase=true pull', 'git config pull.rebase true && git pull', 'git config rebase.autoStash true; git pull',
]));
report('a rebase is refused beside a live writer', stops(['git rebase origin/main', 'git rebase -i HEAD~2', 'git rebase --continue', 'git -C sub rebase main', 'git rebase --onto a b c']));
report('a stash (push, save, bare) is refused beside a live writer', stops(['git stash', 'git stash push', 'git stash push -m wip', 'git stash save wip', 'git stash -k', 'git stash push -- a.rs b.rs', 'git stash push -u']));
report('--autostash is refused on a pull, a rebase and a merge beside a live writer', stops(['git pull --autostash', 'git rebase --autostash main', 'git merge --autostash topic', 'git pull --rebase --autostash']));
report('--autostash is refused even when no other writer is live', stops(['git pull --autostash', 'git pull --rebase --autostash origin main', 'git rebase --autostash main', 'git merge --autostash topic', INCIDENT], alone));
report('control: fetch, push, a plain merge and the stash actions that only read or restore pass beside a live writer', passes([
  'git fetch', 'git fetch origin main', 'git push origin HEAD:main', 'git fetch && git push origin HEAD:main', 'git stash list', 'git stash show', 'git stash show -p', 'git stash show --stat', 'git stash pop',
  'git stash pop --index', 'git stash apply', 'git stash apply stash@{1}', 'git stash drop', 'git stash drop stash@{0}', 'git status', 'git log -1', 'git commit -F msg.txt -- a.rs',
  'git config pull.rebase', 'git config --get merge.autoStash', 'git config --get-all rebase.autoStash', 'git config --get-regexp pull', 'git config --list', 'git config -l', 'git config get user.name', 'git config list',
  'git config --show-origin user.name', 'git config --show-origin --get pull.rebase', 'git config --global --get user.name',
]));
report('KIT-T1266 round 2: a merge is a sweep beside a live writer, so a merge.autoStash set in config cannot stash behind the flag', stops(['git merge topic', 'git merge --ff-only topic', 'git merge --no-ff topic', 'git merge --abort', 'git merge --continue', 'git -C sub merge main']));
report('KIT-T1266 round 3: any git config call that is not plainly a read is a sweep beside a live writer (no list of keys or options)', stops([
  'git config merge.autoStash true', 'git config rebase.autoStash true', 'git config pull.rebase true', 'git config --global pull.rebase true', 'git config --local rebase.autoStash true', 'git config --system merge.autoStash true',
  'git config --replace-all merge.autostash true', 'git config --add pull.rebase merges', 'git config set merge.autoStash true', 'git config MERGE.AUTOSTASH true', 'git config pull.rebase false', 'git -C sub config pull.rebase true',
  'git config --file .git/config pull.rebase true', 'git config --type=bool merge.autoStash true', 'git config --type bool pull.rebase true', 'git config --comment x pull.rebase true', 'git config branch.main.rebase true',
  'git config include.path x', 'git config includeIf.gitdir:x.path y', 'git config user.name x', 'git config core.autocrlf false', 'git config alias.up pull', 'git config --global user.name x', 'git config --add remote.origin.fetch x',
  'git config --unset pull.rebase', 'git config --unset-all pull.rebase', 'git config --edit', 'git config -e', 'git config --remove-section pull', 'git config --rename-section a b', 'git config --value=x pull.rebase true',
  'git config --default x pull.rebase true', 'git config -t bool pull.rebase true',
]));
report('KIT-T1266 round 2: a stash with an option first is a push: git reads an action only as the first token', stops([
  'git stash -m x', 'git stash --keep-index', 'git stash -- a.rs', 'git stash -k', 'git stash -p', 'git stash --include-untracked', 'git stash -m list', 'git stash --keep-index list', 'git stash -q show',
  'git stash push', 'git stash save list',
]));
report('KIT-T1266 round 2: the same on a line whose quoting cannot be split (read blind)', stops([
  "echo it's; git stash -m x", "echo it's; git stash --keep-index", "echo it's; git merge topic", "echo it's; git config pull.rebase true", "echo it's; git config merge.autoStash true", "echo it's; git config user.name x", "echo it's; git config branch.main.rebase true", "echo it's; git pull",
]));
report('control: the blind read still passes a stash action and a config read', passes(["echo it's; git stash list", "echo it's; git stash show -p", "echo it's; git config --get pull.rebase", "echo it's; git fetch"]));
report('control: a merge and a config set pass when no other writer is live', passes(['git merge topic', 'git config pull.rebase true', 'git config merge.autoStash true', 'git config user.name x', 'git config branch.main.rebase true', 'git stash -m x', 'git stash --keep-index'], alone));
const configText = beside('git config user.name x').stderr;
check('the refusal of a git config change says no agent needs one here and to raise it to the coordinator', /not plainly a read/.test(configText) && /raise it to the coordinator/.test(configText) && !/git fetch/.test(configText));
report('control: a pull, a rebase and a stash pass when no other writer is live', passes(['git pull', 'git pull --rebase origin main', 'git rebase origin/main', 'git stash', 'git stash push -m wip', 'git fetch', 'git push origin HEAD:main'], alone));

const text = beside('git pull --rebase origin main').stderr;
check('the refusal names the way out: commit by explicit path, fetch, push, and the coordinator when the push is rejected',
  /git commit -F <message file> -- <your paths>/.test(text) && /git fetch/.test(text) && /git push origin HEAD:main/.test(text) && /raise it to the coordinator, who arranges a quiet moment/.test(text) && /allowed only when no other writer has uncommitted changes/.test(text) && /git pull/.test(text));
check('the refusal of an autostash says it applies whether or not another writer is live', /autostash is refused whether or not another writer is live/.test(alone('git pull --autostash').stderr));

console.log(fails ? `\ngit-integration-guard: ${fails} failed` : '\ngit-integration-guard: all pass');
process.exit(fails ? 1 : 0);
