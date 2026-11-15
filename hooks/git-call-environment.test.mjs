// git-call-environment.test.mjs — a git call that shares its command with any mention of the environment is refused beside a
// live writer (git-call-policy.mjs, KIT-T1262). Reading `$env:TEMP` is refused too: three review rounds showed that no text-level
// recogniser of "this only reads" is sound, so the refusal says what to do instead (run the git call as its own command) and
// names the token it saw. This file is the regression list: every bypass spelling gathered in those rounds, each refused.
// Run: node hooks/git-call-environment.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.CLAUDE_KIT_HOLDERS_DIR = mkdtempSync(join(tmpdir(), 'kit-gitenv-holders-'));
process.env.CLAUDE_KIT_TURN_STATE = mkdtempSync(join(tmpdir(), 'kit-gitenv-state-'));
const { claimFile } = await import('./lib/checkout-holder.mjs');
const { gitCallProblem } = await import('./lib/git-call-policy.mjs');

let fails = 0;
const check = (name, cond) => { console.log(`  ${cond ? 'ok  ' : 'FAIL'}  ${name}`); if (!cond) fails++; };
const problem = (command, sub = 'status', lead = []) => gitCallProblem({ sub, options: [], args: [] }, { lead, raw: command, shell: 'powershell' });
const wrong = (name, commands, shouldRefuse, sub) => {
  const bad = commands.filter((c) => Boolean(problem(c, sub)) !== shouldRefuse);
  check(name, bad.length === 0);
  bad.forEach((c) => console.log(`        ${c}`));
};

const SPELLINGS = [
  // PowerShell: assignments and writes through the variable, the drive and the provider
  '$env:FOO = "x"', '${env:FOO}="x"', '$env:Path += ";x"', '$env:X++', '$env:A = $env:B = "x"', '$env:A, $env:B = 1, 2', '$a, $env:B = 1, 2', '$env:FOO ??= "x"',
  '$env:FOO <# c #> = "x"', '$env:FOO # c\n= "x"', '$env:FOO `\n= "x"', '$ENV:FOO = 1', '${ENV:FOO} = 1', '$env:$n = "x"', '${env:$n} = "x"', '& { $env:FOO = 1 }',
  'if ($true) { $env:FOO = 1 }', 'foreach ($i in 1) { $env:FOO = $i }', 'Write-Host x; $env:FOO = 1', '$env:LD_PRELOAD = "x"', '$env:GIT_EXTERNAL_DIFF = "x"',
  '$env:GIT_PAGER = "x"', '$env:PAGER = "x"', '$env:HOME = "x"', '$env:PATH = "x"', '$env:GIT_CONFIG_COUNT = 1', '$env:GIT_SSH_COMMAND = "x"',
  'Set-Item Env:\\FOO x', 'Set-Item -LiteralPath Env:\\FOO x', 'New-Item -Path Env: -Name FOO -Value x', '$n = "FOO"; Set-Item "Env:$n" x', 'Set-Item -Name FOO -Path Env:\\ -Value x',
  'si Env:FOO x', 'ni Env:FOO -Value x', 'ri Env:FOO', 'cli Env:FOO', 'rni Env:FOO BAR', 'cpi Env:FOO Env:BAR', 'mi Env:FOO Env:BAR', 'Set-Content Env:FOO x',
  'Add-Content Env:FOO x', 'Clear-Content Env:FOO', 'sc Env:FOO x', 'Remove-Item Env:FOO', 'Rename-Item Env:FOO BAR', 'Set-Location Env:', 'SET-ITEM ENV:FOO 1',
  'Set-Item -Path "Env:FOO" -Value x', "Set-Item -Path 'env:FOO' x", 'Set-Variable -Name env:FOO -Value x', 'New-Variable env:FOO x', 'Set-Item Env:FOO x -Force',
  '"x" | Set-Content Env:FOO', 'Get-Content Env:FOO | Set-Content Env:BAR', '(Get-Item Env:FOO).Value = "y"', 'Get-Content x -OutVariable env:FOO',
  'Get-Item Env:FOO | Set-Item -Value x', 'Get-ChildItem Env: | ForEach-Object { Set-Item $_.PSPath 1 }', 'gci Env:A, (si Env:B x)', 'Get-Item Env:A; Set-Item Env:B x',
  "Get-Item 'a;b' Env:FOO | Set-Item -Value x", 'Get-Item Env:FOO # | Set-Item', 'Get-Content "x;y" | Out-Null; ${env:A}; ${env:B} = 1',
  '[Environment]::SetEnvironmentVariable($n, "x")', '[Environment]::SetEnvironmentVariable("FO"+"O", "x")', '[System.Environment]::SetEnvironmentVariable("FOO", "x")',
  '[ENVIRONMENT]::SETENVIRONMENTVARIABLE("a","b")', '[Environment]::GetEnvironmentVariables()["x"] = 1', 'Get-Item Env:$n', '[Environment]::GetEnvironmentVariable($n)',
  'iex \'$env:FOO = 1\'', 'iex "$env:FOO = 1"', 'Invoke-Expression "$env:FOO = 1"', "Invoke-Expression 'Set-Item Env:FOO 1'", 'eval "export A=1"', "eval 'export A=1'",
  // PowerShell: the Environment provider without the Env: drive name
  'Set-Item Environment::FOO x', 'Get-Item Environment::FOO', 'Set-Item Microsoft.PowerShell.Core\\Environment::FOO x', 'Set-Item "Microsoft.PowerShell.Core\\Environment::FOO" x',
  'Get-ChildItem -PSProvider Environment', 'New-PSDrive -Name E -PSProvider Environment -Root .', 'New-PSDrive -Name E -PSProvider $p -Root .', 'Get-PSDrive Env',
  // bash: keywords, flag groups, quoting, backslashes, wrappers
  'export FOO=1', 'export PATH=/x', 'export GIT_DIR=/x', 'export "$N=1"', 'export FOO=1 BAR=2', 'export -n FOO', 'export FOO', 'EXPORT FOO=1', 'setenv FOO 1',
  'declare -x FOO=1', 'declare -ix FOO=1', 'declare -r -x FOO=1', 'declare -x -r FOO=1', 'typeset -x FOO=1', 'typeset -r -x FOO=1', 'typeset -xr FOO=1', 'local -x FOO=1',
  "'export' FOO=1", '"export" FOO=1', '\\export FOO=1', 'ex""port FOO=1', "e'xpo'rt FOO=1", 'set -a', 'set -k', 'set -o keyword', 'set -o allexport', 'set -a; X=1',
  'bash -c "export FOO=1"', 'sh -c "declare -x FOO=1"', 'command export A=1', 'local -x A=1; local -x B=2', 'readonly -x FOO=1; set -a',
  // review round 5: `set` with any option, `Environment` as a word, declare/typeset/local as a command word with any flags
  'set -e', 'set +e', 'set -euo pipefail', 'set -x', 'set -- a b', 'set -o allexport', 'set +o allexport', 'set -e -o allexport', 'set -o errexit -o keyword', 'set foo -o keyword',
  "[type]'System.Environment'", "'System.Environment' -as [type]", '[System.Environment]::NewLine', '[type]"Environment"', '-as [Environment]', '[Type]::GetType("System.Environment")',
  '[ENVIRONMENT]::Foo', 'System.Environment', 'Add-Type -TypeDefinition "class X { void Y() { System.Environment.Exit(0); } }"',
  'declare -a A=(1)', 'declare FOO=1', 'declare -p', 'declare -A m', 'typeset -i n=1', 'typeset -f', 'typeset FOO', 'local', 'local FOO=1', 'local -a x', 'f() { local x; }',
  'if true; then declare A=1; fi', 'time declare A', 'sudo local x', 'bash -c "declare A=1"', "sh -c 'typeset -i n'", "'declare' A=1", 'de""clare A=1', '(declare A=1)', '{ local x; }',
  'A=1 declare -x B=1', '! declare -x B=1', 'coproc declare -x B=1', 'A=1 B=2 declare C', '! local x', 'A=1 local x', 'coproc typeset A', '! typeset -i n', 'A=1 B=2 typeset -x C=3',
  'A="a b" declare -x B=1', 'foo declare -x B=1', 'unknown-prefix typeset -r -x B=1', 'x=1; y=2 declare -x Z', 'time A=1 declare -x B=1',
  'true && declare A=1', 'true || typeset A', 'echo a | declare A', 'while true; do local x; done', 'nohup declare A', 'xargs typeset A', 'eval declare A',
];
check(`the regression list holds at least forty change spellings (${SPELLINGS.length})`, SPELLINGS.length >= 40);
wrong('every spelling is refused before a read-only verb', SPELLINGS.map((c) => `${c}; git status`), true);
wrong('every spelling is refused before each other git verb', SPELLINGS.flatMap((c) => ['show', 'add', 'commit', 'checkout'].map((verb) => `${c}; git ${verb}`)), true);
wrong('every spelling is refused when a git call comes first in a later segment', SPELLINGS.map((c) => `git --version; ${c}; git log -1`), true);

const READS = [
  '$m = Get-Content "$env:TEMP\\msg.txt"; git status --short crates', 'Get-ChildItem Env:TEMP; git diff --stat', 'gci Env: | Out-Null; git status', 'Test-Path Env:\\TEMP; git log -1',
  '[Environment]::GetEnvironmentVariable("TEMP"); git log -1', '$t = $env:TEMP; git status', 'Write-Output "${env:ProgramFiles(x86)}"; git status',
];
wrong('reads of the environment are refused too: the way out is a git call of its own', READS, true);

const PASSES = [
  'echo $HOME; git status', 'echo ${TMPDIR}; git status', 'printenv HOME; git status', 'env; git status', 'F=msg.txt; git commit -F "$F"', 'cd sub && git status',
  'Get-Content C:\\Users\\x\\AppData\\Local\\Temp\\m.txt; git status', 'cd src/local && git status', 'cat docs/environment.md; git add docs/environment.md',
  'git status; $env:FOO = "x"', 'git commit -m "export the helper"', 'git status', 'git commit -F "$F"', 'F=msg.txt; git commit -F "$F"',
  'cd local && git status', 'cd src/local && git status', 'echo declare; git status', 'echo local typeset; git status', 'cat C:\\proj\\Environment\\notes.txt; git status',
  'Get-Content C:\\Users\\x\\AppData\\Local\\Temp\\m.txt; git status', 'Get-Content docs\\environment.md; git add docs\\environment.md', 'ls src/environment; git status',
  'git add docs/environment.md', 'cat ./docs/Environment.md; git diff', 'git log -- environment.rs', 'cd /usr/local/bin && git status', 'git status; set -e',
];
wrong('commands with no environment mention (paths and words that only contain one) pass', PASSES, false);
check('control: a prefix assignment in front of git, an env wrapper with options and a bare assignment of a name in the environment refuse',
  Boolean(problem('HOME=/x git status', 'status', ['HOME=/x'])) && Boolean(problem('env A=1 git status', 'status', ['env', 'A=1'])) && Boolean(problem('env -i git status', 'status', ['env', '-i']))
  && Boolean(problem('PATH=/x; git status')));

const repo = mkdtempSync(join(tmpdir(), 'kit-gitenv-'));
const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
git('init', '-q');
mkdirSync(join(repo, '.ai'), { recursive: true });
git('config', 'user.email', 't@t');
git('config', 'user.name', 't');
git('commit', '-q', '--allow-empty', '-m', 'seed');
claimFile({ tree: git('rev-parse', '--show-toplevel'), session: 'S9', agent: '', label: 'other', rel: 'x.rs', head: 'h' });
const gate = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
const run = (command, tool = 'PowerShell') => spawnSync(process.execPath, [gate], { cwd: repo, env: process.env, encoding: 'utf8', input: JSON.stringify({ session_id: 'S1', tool_name: tool, tool_input: { command } }) });
const blocked = (r) => r.status === 2 && /source-shell-write/.test(r.stderr);

const misfire = run('Get-Content "$env:TEMP\\x.txt"; git status --short crates');
check('the former misfire is refused, with the way out and the token it saw', blocked(misfire)
  && misfire.stderr.includes('run the git call as its own command, with no environment variable read or set in the same command') && misfire.stderr.includes('`$env:`'));
check('the refusal of an export names the export', run('export A=1; git status', 'Bash').stderr.includes('(`export`)'));
check('the way out passes: the git call as its own command', !blocked(run('git status --short crates')));

console.log(fails ? `\ngit-call-environment: ${fails} failed` : '\ngit-call-environment: all pass');
process.exit(fails ? 1 : 0);
