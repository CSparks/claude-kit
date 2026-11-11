#!/usr/bin/env node
// shell-rebinder-qualifiers.test.mjs — two escapes of the rebinder check in shell-variables.mjs (KIT-T1081):
//   1. a PowerShell cmdlet behind a module qualifier (`Microsoft.PowerShell.Utility\Set-Variable`);
//   2. a bash builtin escaped after an unquoted expansion (`$IFS\source f`).
// A cp or Copy-Item whose destination variable the command assigns once is judged by where it lands, unless the
// command rebinds variables: a rebinder keeps the variable unresolved, so the copy stays blocked.
// Run: node hooks/shell-rebinder-qualifiers.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanup, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('shell-rebinder-qualifiers');
const HOOKS = fileURLToPath(new URL('.', import.meta.url));
const BLOCK = 2;
const PASS = 0;

try {
  const repo = tmpDir('kit-qualifiers-');
  execFileSync('git', ['init', '-q'], { cwd: repo });
  mkdirSync(join(repo, '.ai'), { recursive: true });
  const scratch = tmpDir('kit scratch ').replace(/\\/g, '/');
  const src = (command, tool) => spawnSync(process.execPath, [join(HOOKS, 'source-shell-gate.mjs')], { cwd: repo, input: JSON.stringify({ tool_name: tool, tool_input: { command } }), encoding: 'utf8' }).status;
  const bashCopy = (middle) => src(`SP="${scratch}"; ${middle}; cp src/a.cpp "$SP/b.cpp"`, 'Bash');
  const powershellCopy = (middle) => src(`$sp = "${scratch}"; ${middle}; Copy-Item src/a.cpp "$sp\\b.cpp"`, 'PowerShell');

  const qualified = [
    ['Set-Variable', 'Microsoft.PowerShell.Utility\\Set-Variable sp src'],
    ['New-Variable', 'Microsoft.PowerShell.Utility\\New-Variable sp src -Force'],
    ['Clear-Variable', 'Microsoft.PowerShell.Utility\\Clear-Variable sp'],
    ['Remove-Variable', 'Microsoft.PowerShell.Management\\Remove-Variable sp'],
    ['a lower-case qualified cmdlet', 'microsoft.powershell.utility\\set-variable sp src'],
    ['an extensionless path ending in a cmdlet name', 'Copy-Item x src\\Set-Variable'],
    ['the plain cmdlet', 'Set-Variable sp src'],
  ];
  for (const [name, middle] of qualified) ok(`Copy-Item stays blocked: ${name} keeps the variable unresolved`, powershellCopy(middle) === BLOCK);

  const expansionEscapes = [
    ['$IFS\\source', '$IFS\\source f'],
    ['${IFS}\\source', '${IFS}\\source f'],
    ['$IFS\\eval', '$IFS\\eval "SP=src"'],
    ['$1\\source', '$1\\source f'],
    ['text then an expansion then \\source', 'a$IFS\\source f'],
    ['a quoted expansion then \\source', '"$IFS"\\source f'],
    ['$IFS\\unset', '$IFS\\unset SP'],
  ];
  for (const [name, middle] of expansionEscapes) ok(`cp stays blocked: ${name} keeps the variable unresolved`, bashCopy(middle) === BLOCK);

  const pathOperands = [
    ['a Windows path through a source-named file', "cp 'src\\source.cpp' \"$SP/x.bak\""],
    ['a drive root directory named source', "cp 'C:\\source' \"$SP/x.bak\""],
    ['a backslash path through an eval-named file', "cp 'src\\eval.cpp' \"$SP/x.bak\""],
    ['an extensionless backslash path ending in eval', "cp 'src\\eval' \"$SP/x.bak\""],
    ['an expansion then a backslash path to a source-named file', "cp '$HOME\\source.cpp' \"$SP/x.bak\""],
    ['a source-named file', 'cp src/eval-utils.cpp "$SP/x.bak"'],
  ];
  for (const [name, tail] of pathOperands) ok(`cp passes: ${name} is no rebinder`, bashCopy(tail) === PASS);

  const cmdletNamedPaths = [
    ['a file named like a cmdlet behind a backslash', "Copy-Item 'src\\Set-Variable.cpp' \"$sp\\x.bak\""],
    ['a file named like a cmdlet behind a drive path', "Copy-Item 'C:\\x\\New-Variable.ps1' \"$sp\\x.bak\""],
    ['a file named like a cmdlet behind a slash', "Copy-Item src/Remove-Variable.cpp \"$sp\\x.bak\""],
  ];
  for (const [name, tail] of cmdletNamedPaths) ok(`Copy-Item passes: ${name} is no rebinder`, powershellCopy(tail) === PASS);
} finally {
  cleanup();
}
done();
