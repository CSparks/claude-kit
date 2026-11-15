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
  'git fetch', 'git fetch origin main', 'git push origin HEAD:main', 'git fetch && git push origin HEAD:main', 'git merge topic', 'git merge --ff-only topic', 'git stash list', 'git stash show', 'git stash pop',
  'git stash apply', 'git stash drop', 'git status', 'git log -1', 'git commit -F msg.txt -- a.rs',
]));
report('control: a pull, a rebase and a stash pass when no other writer is live', passes(['git pull', 'git pull --rebase origin main', 'git rebase origin/main', 'git stash', 'git stash push -m wip', 'git fetch', 'git push origin HEAD:main'], alone));

const text = beside('git pull --rebase origin main').stderr;
check('the refusal names the way out: commit by explicit path, fetch, push, and the coordinator when the push is rejected',
  /git commit -F <message file> -- <your paths>/.test(text) && /git fetch/.test(text) && /git push origin HEAD:main/.test(text) && /raise it to the coordinator/.test(text) && /git pull/.test(text));
check('the refusal of an autostash says it applies whether or not another writer is live', /autostash is refused whether or not another writer is live/.test(alone('git pull --autostash').stderr));

console.log(fails ? `\ngit-integration-guard: ${fails} failed` : '\ngit-integration-guard: all pass');
process.exit(fails ? 1 : 0);
