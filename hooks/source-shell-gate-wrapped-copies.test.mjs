#!/usr/bin/env node
// source-shell-gate-wrapped-copies.test.mjs — a cp whose destination holds a variable the command assigns once, literally,
// before use is judged by where it lands; every variable the gate cannot prove harmless stays blocked (KIT-T1075). Split from
// source-shell-gate-wrapped.test.mjs so each suite finishes inside one foreground call (KIT-T1271).
// Run: node hooks/source-shell-gate-wrapped-copies.test.mjs

import { assignedValues, expandVariables } from './lib/shell-variables.mjs';
import { segments } from './lib/shell-segments.mjs';
import { BLOCK, PASS, wrappedHarness } from './source-shell-gate-wrapped-harness.mjs';

const { ok, src, scratch, inRepo, finish } = wrappedHarness('source-shell-gate-wrapped-copies');

try {
  const copies = [
    ['a quoted $VAR scratch destination', `SP="${scratch}"; cp src/a.cpp "$SP/a.cpp"`],
    ['a single-quoted value with ${VAR}', `SP='${scratch}'; cp src/a.cpp "\${SP}/a.cpp.bak"`],
    ['export and &&', `export SP="${scratch}" && cp -p src/a.cpp "$SP/b.cpp"`],
    ['an assignment on its own line', `SP="${scratch}"\ncp src/a.cpp "$SP/b.cpp"`],
    ['an unquoted reference to a plain value', 'SP=/tmp/kit-scratch; cp src/a.cpp $SP/b.cpp'],
    ['-t with a variable directory', `SP="${scratch}"; cp -t "$SP" src/a.cpp`],
    ['a second unrelated variable', `A=1; SP="${scratch}"; cp src/a.cpp "$SP/a.cpp"`],
  ];
  for (const [name, command] of copies) ok(`source gate passes cp: ${name}`, src(command) === PASS);
  ok('source gate passes Copy-Item with a PowerShell variable', src(`$sp = "${scratch}"; Copy-Item src/a.cpp "$sp/a.cpp"`, 'PowerShell') === PASS);
  ok('source gate passes Copy-Item with a differently cased PowerShell variable', src(`$sp = '${scratch}'; Copy-Item src/a.cpp "$SP\\a.cpp.bak"`, 'PowerShell') === PASS);

  const namedLikeBuiltins = [
    ['a source-named file in a path', 'cp hooks/source-shell-gate-wrapped.test.mjs "$SP/x.bak"'],
    ['an eval-named file', 'cp src/eval-utils.cpp "$SP/x.bak"'],
    ['a bare file that starts with source-', 'cp source-x.cpp "$SP/x.bak"'],
    ['a bare file that starts with eval.', 'cp eval.cpp "$SP/x.bak"'],
    ['a bare file that ends with -source', 'cp my-source "$SP/x.bak"'],
    ['a directory named source', 'cp src/source/a.cpp "$SP/x.bak"'],
    ['a Windows path through a source-named file', 'cp \'src\\source.cpp\' "$SP/x.bak"'],
    ['a source-named destination', 'cp src/a.cpp "$SP/source.cpp"'],
    ['a dot as a cp operand', 'cp . "$SP/x.bak"'],
    ['a drive path through a source-named file', 'cp \'C:\\x\\source\' "$SP/x.bak"'],
    ['a drive root directory named source', 'cp \'C:\\source\' "$SP/x.bak"'],
    ['an unset-named file', 'cp src/unset-x.cpp "$SP/x.bak"'],
    ['a file named like a PowerShell flag', 'cp src/my-variable.cpp "$SP/x.bak"'],
  ];
  for (const [name, tail] of namedLikeBuiltins) ok(`source gate passes cp: ${name} does not count as a shell rebinder`, src(`SP="${scratch}"; ${tail}`) === PASS);

  const rebinderForms = [
    ['source f', 'source f'],
    ['source f after &&', 'true && source f'],
    ['eval', 'eval "SP=src"'],
    ['eval after a pipe', 'echo x | eval "SP=src"'],
    ['a dot command', '. f'],
    ['a dot command after &&', 'true && . f'],
    ['a dot command in a subshell', '(. f)'],
    ['a dot command behind builtin', 'builtin . f'],
    ['a dot command behind command', 'command . f'],
    ['a dot command after then', 'if true; then . f; fi'],
    ['source after do', 'for i in 1; do source f; done'],
    ['source in a subshell', '(source f)'],
    ['source after a newline', 'true\nsource f'],
    ['source in a brace group', '{ source f; }'],
    ['unset', 'unset SP'],
    ['source behind a builtin wrapper', 'builtin source f'],
    ['an escaped eval', '\\eval "SP=src"'],
    ['an escaped source', '\\source f'],
    ['an escaped source after a semicolon', 'true;\\source f'],
    ['eval split from an expansion', 'eval$IFS"SP=src"'],
    ['source split from a braced expansion', 'source${IFS}f'],
  ];
  for (const [name, form] of rebinderForms) ok(`source gate blocks cp: ${name} keeps the variable unresolved`, src(`SP="${scratch}"; ${form}; cp src/a.cpp "$SP/b.cpp"`) === BLOCK);

  const copyBlocks = [
    ['an unresolved variable naming a source file', 'cp src/a.cpp "$UNKNOWN/a.cpp"'],
    ['an unresolved variable with a non-source tail', 'cp src/a.cpp "$UNKNOWN/a.cpp.bak"'],
    ['an unresolved variable directory', 'cp src/a.cpp "$UNKNOWN"'],
    ['an unresolved $TMPDIR', 'cp src/a.cpp "$TMPDIR/a.cpp"'],
    ['a variable holding a path inside the repo', `R=${inRepo}; cp src/a.cpp "$R/src/b.cpp"`],
    ['a value from a command substitution', 'SP=$(pwd); cp src/a.cpp "$SP/b.cpp"'],
    ['a variable assigned twice', `SP="${scratch}"; SP=src; cp src/a.cpp "$SP/b.cpp"`],
    ['an assignment after the copy', `cp src/a.cpp "$SP/b.cpp"; SP="${scratch}"`],
    ['an assignment inside a pipeline', `echo x | SP="${scratch}"; cp src/a.cpp "$SP/b.cpp"`],
    ['an assignment behind ||', `false || SP="${scratch}"; cp src/a.cpp "$SP/b.cpp"`],
    ['an assignment that is only the copy command prefix', `SP="${scratch}" cp src/a.cpp "$SP/b.cpp"`],
    ['a single-quoted reference', `SP="${scratch}"; cp src/a.cpp '$SP/b.cpp'`],
    ['a ${VAR:-default} expansion', `SP="${scratch}"; cp src/a.cpp "\${SP:-src}/b.cpp"`],
    ['an unquoted reference to a value holding a space', `SP="${scratch}"; cp src/a.cpp $SP/a.cpp`],
    ['a bare value holding a backslash (bash drops it)', 'SP=C:\\x; cp src/a.cpp "$SP/b.cpp"'],
    ['an eval that rebinds the variable out of sight', `SP="${scratch}"; N=S; eval "$N"P=src; cp src/a.cpp "$SP/b.cpp"`],
    ['a loop that rebinds the variable', `SP="${scratch}"; for SP in src; do cp src/a.cpp "$SP/b.cpp"; done`],
    ['a source operand that is a variable', 'cp "$X" src/b.cpp'],
    ['a literal in-repo backup', 'cp src/a.cpp src/a.cpp.bak'],
  ];
  for (const [name, command] of copyBlocks) ok(`source gate blocks cp: ${name}`, src(command) === BLOCK);
  ok('source gate blocks Copy-Item with an unresolved PowerShell variable', src('Copy-Item src/a.cpp "$sp/a.cpp"', 'PowerShell') === BLOCK);
  ok('source gate blocks Copy-Item with a drive-qualified variable name', src(`$sp = "${scratch}"; Copy-Item src/a.cpp "$sp:x"`, 'PowerShell') === BLOCK);
  ok('source gate blocks Copy-Item into a variable holding an in-repo path', src(`$sp = "${inRepo}/src"; Copy-Item src/a.cpp "$sp/b.cpp"`, 'PowerShell') === BLOCK);

  const values = (command, shell = 'bash') => {
    const parts = segments(command, { shell });
    return [...assignedValues(parts, shell).get(parts[parts.length - 1])];
  };
  ok('assignedValues: one literal assignment is visible to the next segment', values('A=x; cp a b').join() === 'A,x');
  ok('assignedValues: nothing is visible to the assigning segment itself', values('A=x').length === 0);
  ok('assignedValues: a PowerShell name is lower-cased', values('$Sp = "x"; Copy-Item a b', 'powershell').join() === 'sp,x');
  ok('expandVariables: double quotes expand any literal', expandVariables('"$A/b"', new Map([['A', 'x y']]), 'bash') === '"x y/b"');
  ok('expandVariables: an unquoted value with a space stays unexpanded', expandVariables('$A/b', new Map([['A', 'x y']]), 'bash') === '$A/b');
  ok('expandVariables: single quotes keep the variable', expandVariables("'$A'", new Map([['A', 'x']]), 'bash') === "'$A'");
  ok('expandVariables: a backslash inside single quotes is literal and closes the span', expandVariables("'\\' \"$A\"", new Map([['A', 'x']]), 'bash') === "'\\' \"x\"");
  ok('expandVariables: a backslash escapes the dollar', expandVariables('"\\$A"', new Map([['A', 'x']]), 'bash') === '"\\$A"');
  ok('expandVariables: ${NAME} braces expand', expandVariables('"${A}/b"', new Map([['A', 'x']]), 'bash') === '"x/b"');
  ok('expandVariables: a longer name is another variable', expandVariables('"$AB"', new Map([['A', 'x']]), 'bash') === '"$AB"');
} finally {
  finish();
}
