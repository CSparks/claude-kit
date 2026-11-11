#!/usr/bin/env node
// shell-variables-allowlist.test.mjs — a variable resolves only when every segment of the command is a known-safe
// command (KIT-T1080, T1081, T1082). A cp or Copy-Item whose destination variable the command assigns once is judged by
// where it lands; any segment the allowlist does not recognise keeps the variable unresolved, so the copy stays blocked.
// Run: node hooks/shell-variables-allowlist.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assignedValues } from './lib/shell-variables.mjs';
import { segments } from './lib/shell-segments.mjs';
import { cleanup, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('shell-variables-allowlist');
const HOOKS = fileURLToPath(new URL('.', import.meta.url));
const BLOCK = 2;
const PASS = 0;

try {
  const repo = tmpDir('kit-allowlist-');
  execFileSync('git', ['init', '-q'], { cwd: repo });
  mkdirSync(join(repo, '.ai'), { recursive: true });
  const scratch = tmpDir('kit scratch ').replace(/\\/g, '/');
  const gate = (command, tool) => spawnSync(process.execPath, [join(HOOKS, 'source-shell-gate.mjs')], { cwd: repo, input: JSON.stringify({ tool_name: tool, tool_input: { command } }), encoding: 'utf8' }).status;
  const bashCopy = (middle) => gate(`SP="${scratch}"; ${middle}; cp src/a.cpp "$SP/b.cpp"`, 'Bash');
  const powershellCopy = (middle) => gate(`$sp = "${scratch}"; ${middle}; Copy-Item src/a.cpp "$sp\\b.cpp"`, 'PowerShell');
  const blocked = (shell, label, cases) => cases.forEach(([name, middle]) => ok(`${label} stays blocked: ${name}`, (shell === 'bash' ? bashCopy : powershellCopy)(middle) === BLOCK));
  const passes = (shell, label, cases) => cases.forEach(([name, middle]) => ok(`${label} passes: ${name}`, (shell === 'bash' ? bashCopy : powershellCopy)(middle) === PASS));

  blocked('powershell', 'Copy-Item', [
    ['Set-Variable', 'Set-Variable sp src'],
    ['the sv alias', 'sv sp src'],
    ['the set alias', 'set sp src'],
    ['the nv alias', 'nv sp src -Force'],
    ['the clv alias', 'clv sp'],
    ['the rv alias', 'rv sp'],
    ['a module-qualified cmdlet', 'Microsoft.PowerShell.Utility\\Set-Variable sp src'],
    ['Set-Item on variable:', 'Set-Item variable:sp src'],
    ['New-Item on variable:', 'New-Item variable:sp -Value src -Force'],
    ['Remove-Item on variable:', 'Remove-Item variable:sp'],
    ['Clear-Item on variable:', 'Clear-Item variable:sp'],
    ['Set-Content on a Variable:\\ path', 'Set-Content -Path Variable:\\sp -Value src'],
    ['a provider-qualified Variable:: path', 'Set-Item Microsoft.PowerShell.Core\\Variable::sp src'],
    ['a location moved into variable:', 'cd variable:'],
    ['a copy into variable:', 'Copy-Item src/a.cpp variable:sp'],
    ['a braced assignment', "${sp} = 'src'"],
    ['a scope-qualified assignment', "$script:sp = 'src'"],
    ['a global-qualified assignment', "$global:sp = 'src'"],
    ['a second assignment', "$sp = 'src'"],
    ['a compound assignment', "$sp += 'x'"],
    ['a list assignment', "$sp, $x = 'src', 'y'"],
    ['a [ref] assignment', "([ref]$sp).Value = 'src'"],
    ['an assignment inside parentheses', "echo ($sp = 'src')"],
    ['a cmdlet inside parentheses', 'echo (sv sp src)'],
    ['a cmdlet inside a copy argument', 'Copy-Item a (sv sp src -PassThru)'],
    ['an assignment inside a subexpression', "echo $($sp = 'src')"],
    ['a script block', "& { $sp = 'src' }"],
    ['a dot-sourced script', '. .\\f.ps1'],
    ['Invoke-Expression', 'Invoke-Expression "$sp = 1"'],
    ['the iex alias', "iex '$sp = 1'"],
    ['a foreach loop variable', "foreach ($sp in 'src') { }"],
    ['PSVariable.Set', "$ExecutionContext.SessionState.PSVariable.Set('sp', 'src')"],
    ['-OutVariable', 'Copy-Item a b -OutVariable sp'],
    ['-ErrorVariable', 'Copy-Item a b -ErrorVariable sp'],
    ['-WarningVariable', 'Copy-Item a b -WarningVariable sp'],
    ['-InformationVariable', 'Copy-Item a b -InformationVariable sp'],
    ['-PipelineVariable', 'Copy-Item a b -PipelineVariable sp'],
    ['the -ov alias', 'echo hi -ov sp'],
    ['the -ev alias', 'echo hi -ev sp'],
    ['the -wv alias', 'echo hi -wv sp'],
    ['the -iv alias', 'echo hi -iv sp'],
    ['the -pv alias', 'echo hi -pv sp'],
    ['an abbreviated -OutV', 'Copy-Item a b -OutV sp'],
    ['the colon form -ErrorVariable:sp', 'Copy-Item a b -ErrorVariable:sp'],
    ['an en-dash parameter prefix', 'echo hi \u2013ov sp'],
    ['-OutVariable on echo', 'echo hi -OutVariable sp'],
    ['-ErrorVariable on ls', 'ls -ErrorVariable sp'],
    ['a splatted parameter table', 'echo @opts'],
    ['a backtick-split variable: drive', 'cd Var`iable:'],
    ['backtick-split variable: operands', 'Copy-Item Var`iable:PWD Var`iable:sp'],
    ['a backtick-split -OutVariable', 'echo hi -O`utVariable sp'],
    ['a wildcard drive', 'cd Var*:'],
    ['the function: drive', 'cd function:'],
    ['the env: drive', 'cd env:'],
    ['a drive bound to a parameter', 'echo hi -Path:variable:sp'],
    ['a command named by a variable', '& $cmd sp'],
    ['an unlisted cmdlet', 'Get-Variable sp'],
  ]);

  blocked('bash', 'cp', [
    ['a quote-split eval', "N=S; e'v'al \"$N\"P=src"],
    ['a double-quote-split eval', 'N=S; ev"al" "$N"P=src'],
    ['a backslash eval', 'N=S; \\eval "$N"P=src'],
    ['a quoted source', '"source" f'],
    ['a half-quoted source', "s'ource' f"],
    ['a quoted dot', "'.' f"],
    ['a quote-split unset', "un'set' SP"],
    ['declare -n', 'declare -n R=SP; R=src'],
    ['typeset -n', 'typeset -n R=SP; R=src'],
    ['local -n', 'local -n R=SP; R=src'],
    ['export -n', 'export -n SP'],
    ['a second declare', 'declare SP=src'],
    ['arithmetic expansion', 'N=SP; echo $(($N=1))'],
    ['test (it evaluates subscripts)', 'test -d src'],
    ['a backslash-hidden test -v subscript', 'N=SP; test -v a\\[$N=1]'],
    ['an empty-quote-hidden test -v subscript', 'N=SP; test -v a""[$N=1]'],
    ['a bracket test -v subscript', 'N=SP; [ -v "a[$N=1]" ]'],
    ['a PATH assignment', 'export PATH=/x:src'],
    ['a PATH prefix on a listed command', 'PATH=/x echo hi'],
    ['an IFS prefix on a listed command', 'IFS=/ echo hi'],
    ['an arithmetic command', 'N=SP; (( $N=1 ))'],
    ['let', 'N=SP; let "$N=1"'],
    ['an old arithmetic expansion', 'N=SP; echo $[$N=1]'],
    ['a := default expansion', 'echo ${SP:=src}'],
    ['a = default expansion', 'echo ${SP=src}'],
    ['a colon command with :=', ': ${SP:=src}'],
    ['a test -v subscript', 'N=SP; test -v "a[$N=1]"'],
    ['an array subscript assignment', 'N=SP; a[$N=1]=x'],
    ['read', 'read SP <<< src'],
    ['printf -v', 'printf -v SP %s src'],
    ['mapfile', 'mapfile SP < f'],
    ['getopts', 'getopts a SP'],
    ['a for loop', 'for SP in src; do true; done'],
    ['a while read loop', 'while read SP; do true; done'],
    ['unset', 'unset SP'],
    ['a command substitution', 'echo $(true)'],
    ['a backtick substitution', 'echo `true`'],
    ['a process substitution', 'echo <(true)'],
    ['a funsub', 'echo ${ SP=src; }'],
    ['a pipe funsub', 'echo ${|true}'],
    ['a command named by a variable', '$CMD f'],
    ['a braced command name', '${CMD} f'],
    ['a function shadowing cp', 'cp() { SP=src; }'],
    ['an alias shadowing cp', "alias cp='SP=src; cp'"],
    ['a subshell command word', 'bash -c "SP=src"'],
    ['a brace group', '{ SP=src; }'],
    ['a path-qualified command', '/bin/echo hi'],
    ['a command prefixed by an assignment and eval', 'N=S; X=1 eval "$N"P=src'],
    ['a plain eval', 'N=S; eval "$N"P=src'],
    ['an upper-case command word', 'Echo hi'],
    ['a conditional second assignment', 'true && SP=src'],
    ['IFS assignment', 'IFS=/'],
    ['an IFS declaration', 'export IFS=/'],
  ]);

  const pwdCopy = (name, assign, move) => ok(`cp stays blocked: ${name}`, gate(`${assign}; ${move}; cp src/a.cpp "$${name}/b.cpp"`, 'Bash') === BLOCK);
  pwdCopy('PWD', `PWD="${scratch}"`, 'cd src');
  pwdCopy('OLDPWD', `OLDPWD="${scratch}"`, 'cd src');
  pwdCopy('RANDOM', `RANDOM="${scratch}"`, 'true');
  pwdCopy('SECONDS', `SECONDS="${scratch}"`, 'true');
  pwdCopy('LINENO', `LINENO="${scratch}"`, 'true');
  ok('Copy-Item stays blocked: $pwd resolved from an assignment', gate(`$pwd = "${scratch}"; cd src; Copy-Item src/a.cpp "$pwd\\b.cpp"`, 'PowerShell') === BLOCK);

  passes('bash', 'cp', [
    ['mkdir', 'mkdir -p "$SP/d"'],
    ['cd', 'cd src'],
    ['echo', 'echo hi'],
    ['true', 'true'],
    ['ls', 'ls src'],
    ['pwd', 'pwd'],
    ['an unrelated assignment', 'A=1'],
    ['an unrelated export', 'export A=1'],
    ['an unrelated declare', 'declare A=1'],
    ['a second copy', 'cp src/b.cpp "$SP/c.cpp"'],
    ['a move', 'mv "$SP/c.cpp" "$SP/d.cpp"'],
    ['a prefix assignment on a listed command', 'A=1 echo hi'],
    ['a quoted listed command', '"echo" hi'],
    ['an empty segment', ''],
    ['hooks/source-x.mjs as an operand', 'cp hooks/source-x.mjs "$SP/x.bak"'],
    ['src\\source.cpp as an operand', "cp 'src\\source.cpp' \"$SP/x.bak\""],
    ['C:\\source as an operand', "cp 'C:\\source' \"$SP/x.bak\""],
    ['a file named eval-utils.cpp', 'cp src/eval-utils.cpp "$SP/x.bak"'],
    ['a file named unset-x.cpp', 'cp src/unset-x.cpp "$SP/x.bak"'],
  ]);
  ok('cp passes: a trailing semicolon after the copy', gate(`SP="${scratch}"; cp src/a.cpp "$SP/b.cpp";`, 'Bash') === PASS);
  ok('cp passes: only the assignment and the copy', gate(`SP="${scratch}"; cp src/a.cpp "$SP/b.cpp"`, 'Bash') === PASS);
  ok('cp blocks: an unresolved destination variable', gate('cp src/a.cpp "$UNKNOWN/b.cpp"', 'Bash') === BLOCK);
  ok('cp blocks: a destination resolved inside the repo', gate(`R=${repo.replace(/\\/g, '/')}; cp src/a.cpp "$R/src/b.cpp"`, 'Bash') === BLOCK);

  passes('powershell', 'Copy-Item', [
    ['a second copy', 'Copy-Item src/b.cpp "$sp\\c.cpp"'],
    ['-Force', 'Copy-Item src/b.cpp "$sp\\c.cpp" -Force'],
    ['-Force', 'Copy-Item src/b.cpp "$sp\\c.cpp" -Force'],
    ['a lower-case cmdlet', 'copy-item src/b.cpp "$sp\\c.cpp"'],
    ['mkdir', 'mkdir x'],
    ['a drive-letter operand', 'Copy-Item "C:\\x\\a.txt" "$sp\\c.cpp"'],
    ['a $env: qualified operand', 'echo "$env:TEMP"'],
    ['a parameter bound with a colon', 'echo hi -Verbose:$true'],
    ['ls', 'ls src'],
    ['cd', 'cd src'],
    ['echo', 'echo hi'],
    ['a preference variable assignment', "$ErrorActionPreference = 'Stop'"],
    ['a file named like a cmdlet', "Copy-Item 'src\\Set-Variable.cpp' \"$sp\\x.bak\""],
    ['a file named source', "Copy-Item 'src\\source.cpp' \"$sp\\x.bak\""],
  ]);
  ok('Copy-Item blocks: an unresolved variable', gate('Copy-Item src/a.cpp "$sp\\b.cpp"', 'PowerShell') === BLOCK);

  const values = (command, shell = 'bash') => {
    const parts = segments(command, { shell });
    return [...assignedValues(parts, shell).get(parts[parts.length - 1])];
  };
  ok('assignedValues: a known-safe command keeps the assignment visible', values('A=x; echo hi; cp a b').join() === 'A,x');
  ok('assignedValues: an unrecognised command leaves nothing visible', values('A=x; frob hi; cp a b').length === 0);
  ok('assignedValues: a command word is judged after quotes are removed', values("A=x; e'c'ho hi; cp a b").join() === 'A,x');
  ok('assignedValues: ambiguous quoting leaves nothing visible', values("A=x; echo $'y'; cp a b").length === 0);
  ok('assignedValues: PWD is never resolved', values('PWD=x; cp a b').length === 0);
} finally {
  cleanup();
}
done();
