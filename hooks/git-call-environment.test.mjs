// git-call-environment.test.mjs — what counts as an environment change before a git call (KIT-T1262), judged fail-closed
// (env-change.mjs, git-call-policy.mjs). Reading `$env:TEMP` is no change and the original misfire must pass; every other way
// of naming the environment before a git call is refused, whatever the git verb: a read-only verb is exempt only for a change
// whose literal variable is on HARMLESS_ENV_NAMES (empty).
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
const { environmentChanges } = await import('./lib/env-change.mjs');
const { HARMLESS_ENV_NAMES, exemptReadOnly, gitCallProblem } = await import('./lib/git-call-policy.mjs');

let fails = 0;
const check = (name, cond) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`); if (!cond) fails++; };
const problem = (command, sub = 'status') => gitCallProblem({ sub, options: [], args: [] }, { lead: [], raw: command, shell: 'powershell' });
const refused = (commands, sub) => commands.filter((c) => !problem(c, sub));
const passed = (commands, sub) => commands.filter((c) => problem(c, sub));
const report = (name, wrong) => { check(name, wrong.length === 0); wrong.forEach((c) => console.log(`        ${c}`)); };

const READS = [
  '$m = Get-Content "$env:TEMP\\msg.txt"; git status --short crates',
  'Get-ChildItem Env:TEMP; git diff --stat',
  'gci Env: | Out-Null; git status',
  'Test-Path Env:\\TEMP; git log -1',
  'cat Env:TEMP; git show HEAD',
  'Get-Item Env:TEMP | Select-Object Value; git status',
  '[Environment]::GetEnvironmentVariable("TEMP"); git log -1',
  '$t = $env:TEMP; $env:TEMP | Out-Null; git status',
  'Write-Output "${env:ProgramFiles(x86)}"; git status',
];
report('the original misfire and the other plain reads pass', passed(READS));

const NAMED_WRONG = ['$env:FOO = "x"; git status', '${env:FOO}="x"; git status', '$env:Path += ";x"; git status', '$env:X++; git status', '$env:A = $env:B = "x"; git status'];
report('finding 1: an assignment to a literal name is refused before a read-only verb (the allow-list is empty)', refused(NAMED_WRONG));
report('finding 1: names that cannot be read to a literal are refused', refused([
  'Set-Item Env:\\FOO x; git status', 'Set-Item -LiteralPath Env:\\FOO x; git log -1', 'New-Item -Path Env: -Name FOO -Value x; git status',
  '$n = "FOO"; Set-Item "Env:$n" x; git status', '[Environment]::SetEnvironmentVariable($n, "x"); git status', '[Environment]::SetEnvironmentVariable("FO"+"O", "x"); git diff',
  '[System.Environment]::SetEnvironmentVariable("FOO", "x"); git status', '$env:$n = "x"; git status', '${env:$n} = "x"; git status',
  'Set-Item -Name FOO -Path Env:\\ -Value x; git status', 'Set-Location Env:; git status',
]));
report('finding 2: the item-cmdlet aliases and content cmdlets on Env: are refused', refused([
  'si Env:FOO x; git status', 'ni Env:FOO -Value x; git status', 'ri Env:FOO; git status', 'cli Env:FOO; git status', 'rni Env:FOO BAR; git status',
  'cpi Env:FOO Env:BAR; git status', 'mi Env:FOO Env:BAR; git status', 'Set-Content Env:FOO x; git status', 'Add-Content Env:FOO x; git status',
  'Clear-Content Env:FOO; git status', 'Remove-Item Env:FOO; git log -1', 'Rename-Item Env:FOO BAR; git status', 'sc Env:FOO x; git status',
]));
report('finding 2: multiple assignment and write-through forms are refused', refused([
  '$env:A, $env:B = 1, 2; git status', '$a, $env:B = 1, 2; git status', '(Get-Item Env:FOO).Value = "y"; git status',
  'Get-Content x -OutVariable env:FOO; git status', 'Get-Item Env:FOO | Set-Item -Value x; git status', 'Get-ChildItem Env: | ForEach-Object { Set-Item $_.PSPath 1 }; git status',
  'gci Env:A, (si Env:B x); git status', 'Get-Item Env:A; Set-Item Env:B x; git status',
]));
report('finding 3: a bash change of any name is refused before a read-only verb', refused([
  'export FOO=1; git status', 'export PATH=/x; git log', 'export GIT_DIR=/x; git diff', 'declare -x FOO=1; git show HEAD', 'typeset -x FOO=1; git status',
  'set -a; X=1; git status', 'setenv FOO 1; git status', 'export "$N=1"; git status', 'export FOO=1 BAR=2; git status',
]));
report('finding 3: variables that redirect git or load code are refused in PowerShell', refused([
  '$env:GIT_EXTERNAL_DIFF = "x"; git diff', '$env:GIT_PAGER = "x"; git log', '$env:PAGER = "x"; git show', '$env:LD_PRELOAD = "x"; git status',
  '$env:GIT_CONFIG_COUNT = 1; git status', '$env:GIT_SSH_COMMAND = "x"; git status', '$env:HOME = "x"; git status', '$env:PATH = "x"; git status',
]));
report('control: a writing verb after any change is refused', refused(['$env:FOO = "x"; git add .', 'export FOO=1; git commit -m x'], 'add'));
check('a change after the git word is no change before it', !problem('git status; $env:FOO = "x"') && !problem('git commit -m "export the helper"', 'commit'));

check('the allow-list of harmless names ships empty', HARMLESS_ENV_NAMES.length === 0);
const names = (text) => environmentChanges(text).map((c) => c.name);
check('a literal assignment parses to its name, a computed or drive-path one to null', names('$env:FOO = 1').join() === 'FOO' && names('${env:FOO} = 1').join() === 'FOO'
  && names('export A=1 B=2').join() === 'A,B' && names('Set-Item Env:FOO x').length === 1 && names('Set-Item Env:FOO x')[0] === null && names('[Environment]::SetEnvironmentVariable("FOO","x")').includes('FOO') && names('$env:$n = 1').includes(null));
check('the exemption with an injected allow-list: literal harmless names only', exemptReadOnly(environmentChanges('$env:FOO = 1'), ['foo']) && !exemptReadOnly(environmentChanges('$env:BAR = 1'), ['foo'])
  && !exemptReadOnly(environmentChanges('$env:FOO = 1; Set-Item Env:BAZ x'), ['foo']) && !exemptReadOnly([], ['foo']) && !exemptReadOnly(environmentChanges('set -a'), ['foo']));

const repo = mkdtempSync(join(tmpdir(), 'kit-gitenv-'));
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
git('init', '-q');
mkdirSync(join(repo, '.ai'), { recursive: true });
git('config', 'user.email', 't@t');
git('config', 'user.name', 't');
git('commit', '-q', '--allow-empty', '-m', 'seed');
claimFile({ tree: git('rev-parse', '--show-toplevel'), session: 'S9', agent: '', label: 'other', rel: 'x.rs', head: 'h' });
const gate = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
const stops = (command, tool = 'PowerShell') => {
  const r = spawnSync(process.execPath, [gate], { cwd: repo, env: process.env, encoding: 'utf8', input: JSON.stringify({ session_id: 'S1', tool_name: tool, tool_input: { command } }) });
  return r.status === 2 && /source-shell-write/.test(r.stderr);
};
check('end to end beside a live writer: the misfire passes', !stops('$m = Get-Content "$env:TEMP\\msg.txt"; git status --short crates'));
check('end to end beside a live writer: a write is refused, even before a read-only verb', stops('Set-Item Env:\\FOO x; git status') && stops('$env:FOO = "x"; git log -1') && stops('export FOO=1; git diff HEAD', 'Bash'));

console.log(fails ? `\ngit-call-environment: ${fails} failed` : '\ngit-call-environment: all pass');
process.exit(fails ? 1 : 0);
