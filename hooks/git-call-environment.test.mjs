// git-call-environment.test.mjs — what counts as an environment change before a git call (KIT-T1262), judged by INVERSION
// (env-change.mjs): a command is no change only when every mention of the environment in it is a known read form. The
// original misfire (a read of `$env:TEMP`) passes; every other spelling refuses, whatever the git verb, so a form nobody listed
// is a refusal. Run: node hooks/git-call-environment.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'kit-gitenv-holders-'));
process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'kit-gitenv-state-'));
const { claimFile } = await import('./lib/checkout-holder.mjs');
const { environmentChanges } = await import('./lib/env-change.mjs');
const { gitCallProblem } = await import('./lib/git-call-policy.mjs');

let fails = 0;
const check = (name, cond) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`); if (!cond) fails++; };
const problem = (command, sub = 'status') => gitCallProblem({ sub, options: [], args: [] }, { lead: [], raw: command, shell: 'powershell' });
const wrong = (name, commands, shouldRefuse, sub) => {
  const bad = commands.filter((c) => Boolean(problem(c, sub)) !== shouldRefuse);
  check(name, bad.length === 0);
  bad.forEach((c) => console.log(`        ${c}`));
};

const READS = [
  '$m = Get-Content "$env:TEMP\\msg.txt"; git status --short crates',
  'Get-ChildItem Env:TEMP; git diff --stat', 'gci Env: | Out-Null; git status', 'Test-Path Env:\\TEMP; git log -1', 'cat Env:TEMP; git show HEAD',
  'Get-Item Env:TEMP | Select-Object Value; git status', 'dir Env:; git status', 'gi Env:Path | Out-String; git status', 'ls Env: | Sort-Object Name | Out-Host; git status',
  '[Environment]::GetEnvironmentVariable("TEMP"); git log -1', '[System.Environment]::GetEnvironmentVariable("TEMP", "Machine"); git status',
  '$t = $env:TEMP; $env:TEMP | Out-Null; git status', 'Write-Output "${env:ProgramFiles(x86)}"; git status', '$p = Join-Path $env:TEMP "x"; git status',
  'echo $HOME; git status', 'echo ${TMPDIR}; git status', 'printenv HOME; git status', 'env; git status', 'F=msg.txt; git commit -F "$F"', 'cd sub && git status',
];
wrong('the original misfire and the other known read forms pass', READS, false);

const OURS = [
  '$env:FOO = "x"', '${env:FOO}="x"', '$env:Path += ";x"', '$env:X++', '$env:A = $env:B = "x"', '$env:A, $env:B = 1, 2', '$a, $env:B = 1, 2', '$env:FOO ??= "x"',
  'Set-Item Env:\\FOO x', 'Set-Item -LiteralPath Env:\\FOO x', 'New-Item -Path Env: -Name FOO -Value x', '$n = "FOO"; Set-Item "Env:$n" x', 'Set-Item -Name FOO -Path Env:\\ -Value x',
  'si Env:FOO x', 'ni Env:FOO -Value x', 'ri Env:FOO', 'cli Env:FOO', 'rni Env:FOO BAR', 'cpi Env:FOO Env:BAR', 'mi Env:FOO Env:BAR',
  'Set-Content Env:FOO x', 'Add-Content Env:FOO x', 'Clear-Content Env:FOO', 'sc Env:FOO x', 'Remove-Item Env:FOO', 'Rename-Item Env:FOO BAR', 'Set-Location Env:',
  '[Environment]::SetEnvironmentVariable($n, "x")', '[Environment]::SetEnvironmentVariable("FO"+"O", "x")', '[System.Environment]::SetEnvironmentVariable("FOO", "x")',
  '$env:$n = "x"', '${env:$n} = "x"', '(Get-Item Env:FOO).Value = "y"', 'Get-Content x -OutVariable env:FOO', 'Get-Item Env:FOO | Set-Item -Value x',
  'Get-ChildItem Env: | ForEach-Object { Set-Item $_.PSPath 1 }', 'gci Env:A, (si Env:B x)', 'Get-Item Env:A; Set-Item Env:B x',
  'Get-Item Env:$n', '[Environment]::GetEnvironmentVariable($n)', '[Environment]::GetEnvironmentVariables()["x"] = 1',
];
const REVIEW = [
  'Set-Item Environment::FOO x', 'Get-Item Environment::FOO', 'Set-Item Microsoft.PowerShell.Core\\Environment::FOO x', 'Set-Item "Microsoft.PowerShell.Core\\Environment::FOO" x',
  'Get-ChildItem -PSProvider Environment', 'New-PSDrive -Name E -PSProvider Environment -Root .', 'New-PSDrive -Name E -PSProvider $p -Root .', 'Get-PSDrive Env',
  'declare -ix FOO=1', 'declare -r -x FOO=1', 'declare -x -r FOO=1', 'typeset -r -x FOO=1', 'typeset -xr FOO=1', 'local -x FOO=1', 'local FOO=1',
  "'export' FOO=1", '"export" FOO=1', '\\export FOO=1', 'ex""port FOO=1', "e'xpo'rt FOO=1", 'set -k', 'set -o keyword', 'set -a', 'set -o allexport', 'set +o', 'setenv FOO 1', 'export -n FOO', 'export FOO',
];
const MORE = [
  'export FOO=1', 'export PATH=/x', 'export GIT_DIR=/x', 'declare -x FOO=1', 'typeset -x FOO=1', 'export "$N=1"', 'export FOO=1 BAR=2', 'EXPORT FOO=1',
  '$ENV:FOO = 1', '${ENV:FOO} = 1', 'SET-ITEM ENV:FOO 1', '[ENVIRONMENT]::SETENVIRONMENTVARIABLE("a","b")', 'Set-Item -Path "Env:FOO" -Value x', "Set-Item -Path 'env:FOO' x",
  'Set-Variable -Name env:FOO -Value x', 'New-Variable env:FOO x', '$env:LD_PRELOAD = "x"', '$env:GIT_EXTERNAL_DIFF = "x"', '$env:GIT_PAGER = "x"', '$env:PAGER = "x"', '$env:HOME = "x"',
  '$env:PATH = "x"', '$env:GIT_CONFIG_COUNT = 1', '$env:GIT_SSH_COMMAND = "x"', '& { $env:FOO = 1 }', 'if ($true) { $env:FOO = 1 }', 'foreach ($i in 1) { $env:FOO = $i }',
  'Write-Host x; $env:FOO = 1', 'Set-Item Env:FOO x -Force', '"x" | Set-Content Env:FOO', 'Get-Content Env:FOO | Set-Content Env:BAR', 'Invoke-Expression "$env:FOO = 1"',
  'bash -c "export FOO=1"', 'sh -c "declare -x FOO=1"', 'local -x A=1; local -x B=2', 'readonly -x FOO=1; set -a',
];
wrong('the review\'s bypass forms are each refused before a read-only verb', REVIEW.map((c) => `${c}; git status`), true);
wrong('every earlier bypass form is refused before a read-only verb', OURS.map((c) => `${c}; git log -1`), true);
wrong('further spellings are refused before a read-only verb', MORE.map((c) => `${c}; git diff HEAD`), true);
const ALL = [...OURS, ...REVIEW, ...MORE];
check(`the property list holds at least forty change spellings (${ALL.length})`, ALL.length >= 40);
wrong('property: every spelling refuses before every git verb that reads or writes', ALL.flatMap((c) => ['status', 'show', 'add', 'commit', 'checkout'].map((verb) => `${c}; git ${verb}`)), true);
wrong('property: the same spellings refuse when the git call comes first in a later segment', ALL.map((c) => `git --version; ${c}; git status`), true);
check('a change after the git word is no change before it', !problem('git status; $env:FOO = "x"') && !problem('git commit -m "export the helper"', 'commit'));
check('control: a prefix assignment in front of git still refuses', Boolean(gitCallProblem({ sub: 'status', options: [], args: [] }, { lead: ['HOME=/x'], raw: 'HOME=/x git status', shell: '' })));

const mentions = (text) => environmentChanges(text).length;
check('the scan reads through quotes, backslashes and backticks', mentions("'ex'port FOO=1") === 1 && mentions('ex\\port FOO=1') === 1 && mentions('ex`port FOO=1') === 1 && mentions('"exp""ort" x') === 1);
check('a known read form leaves no mention, an unknown one leaves one', mentions('Get-Content $env:TEMP\\a.txt') === 0 && mentions('$env:TEMP = 1') === 1 && mentions('Get-Item Env:A') === 0 && mentions('Get-Item Env:A -Name; x') === 0 && mentions('Get-Item Environment::A') === 1);

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
check('end to end beside a live writer: the review\'s forms are refused', stops('Set-Item Environment::FOO x; git status') && stops('declare -ix FOO=1; git status', 'Bash') && stops("'export' FOO=1; git log -1", 'Bash'));

console.log(fails ? `\ngit-call-environment: ${fails} failed` : '\ngit-call-environment: all pass');
process.exit(fails ? 1 : 0);
