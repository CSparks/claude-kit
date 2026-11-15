// git-call-environment.test.mjs — what counts as an environment change before a git call (KIT-T1262). Reading `$env:TEMP` is
// not one; only an assignment is. A read-only verb (status, log, diff, show, ls-tree, merge-base, rev-parse ...) is exempt from the
// environment-change rule unless the change names a variable that redirects git (GIT_*, PATH, PAGER, HOME ...). The gate
// refuses the rest while another writer is live in the checkout (git-call-policy.mjs).
// Run: node hooks/git-call-environment.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const holders = mkdtempSync(join(tmpdir(), 'kit-gitenv-holders-'));
process.env.CLAUDE_KIT_HOLDERS_DIR = holders;
process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'kit-gitenv-state-'));
const { claimFile } = await import('./lib/checkout-holder.mjs');

const repo = mkdtempSync(join(tmpdir(), 'kit-gitenv-'));
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
git('init', '-q');
mkdirSync(join(repo, '.ai'), { recursive: true });
git('config', 'user.email', 't@t');
git('config', 'user.name', 't');
git('commit', '-q', '--allow-empty', '-m', 'seed');
claimFile({ tree: git('rev-parse', '--show-toplevel'), session: 'S9', agent: '', label: 'other', rel: 'x.rs', head: 'h' });

let fails = 0;
const check = (name, cond) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`); if (!cond) fails++; };
const gate = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
const stops = (command, tool = 'Bash') => {
  const r = spawnSync(process.execPath, [gate], { cwd: repo, env: process.env, encoding: 'utf8', input: JSON.stringify({ session_id: 'S1', tool_name: tool, tool_input: { command } }) });
  return r.status === 2 && /source-shell-write/.test(r.stderr);
};
const stopsPs = (command) => stops(command, 'PowerShell');

check('reading $env:TEMP before git status passes', !stopsPs('$m = Get-Content "$env:TEMP\\msg.txt"; git status --short crates'));
check('reading the Env: drive or GetEnvironmentVariable before a git call passes', !stopsPs('Get-ChildItem Env:TEMP; git diff --stat') && !stopsPs('[Environment]::GetEnvironmentVariable("TEMP"); git log -1'));
check('control: assigning a PowerShell environment variable before a writing git call is refused', stopsPs("$env:FOO = 'x'; git add .") && stopsPs('${env:FOO} = "x"; git add .'));
check('control: Set-Item on the Env: drive and SetEnvironmentVariable before a writing git call are refused', stopsPs('Set-Item Env:FOO x; git add .') && stopsPs("[Environment]::SetEnvironmentVariable('FOO','x'); git add ."));
check('a read-only verb passes after an environment change that does not redirect git', !stopsPs("$env:FOO = 'x'; git status") && !stopsPs("$env:FOO = 'x'; git log -1") && !stops('export FOO=1; git diff HEAD') && !stops('export FOO=1; git show HEAD'));
check('the other read-only verbs pass too', !stops('export FOO=1; git rev-parse HEAD') && !stops('export FOO=1; git ls-tree HEAD') && !stops('export FOO=1; git merge-base HEAD HEAD'));
check('control: a read-only verb after a change that redirects git is refused', stopsPs("$env:PATH = 'x'; git status") && stopsPs("$env:GIT_EXTERNAL_DIFF = 'x'; git diff") && stops('export GIT_DIR=/x; git log') && stops('export PATH=/x:$PATH; git status'));
check('control: a verb that writes after an environment change is refused', stopsPs("$env:FOO = 'x'; git add .") && stops('export FOO=1; git commit -m x'));
check('control: an environment prefix in front of a read-only verb is refused', stops('HOME=/x git status') && stops('GIT_DIR=/x git log'));
check('control: a PowerShell variable is no environment change', !stopsPs("$f = 'msg.txt'; git status"));

console.log(fails ? `\ngit-call-environment: ${fails} failed` : '\ngit-call-environment: all pass');
process.exit(fails ? 1 : 0);
