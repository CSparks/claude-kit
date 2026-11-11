#!/usr/bin/env node
// source-shell-gate-wrapped.test.mjs — three escapes of the shell write gates (KIT-T1075):
//   1. an applier behind a wrapper (`sudo`, `env A=1`, `timeout 5`) or a grouping word in a command whose quoting
//      cannot be trusted is judged by the same lead scan as a plain one;
//   2. an applier inside `bash -c "..."`, `sh -lc`, `pwsh -Command` or `eval` is judged by the same rules;
//   3. a cp whose destination holds a variable the command assigns once, literally, before use is judged by where it lands.
// Every control that stays blocked is a variable or applier the gate cannot prove harmless.
// Run: node hooks/source-shell-gate-wrapped.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appliesPatch } from './lib/patch-apply.mjs';
import { assignedValues, expandVariables } from './lib/shell-variables.mjs';
import { segments } from './lib/shell-segments.mjs';
import { cleanup, reporter, tmpDir } from './test-harness.mjs';

const { ok, done } = reporter('source-shell-gate-wrapped');
const HOOKS = fileURLToPath(new URL('.', import.meta.url));
const BLOCK = 2;
const PASS = 0;

const SRC_DIFF = 'diff --git a/src/ui/Main.h b/src/ui/Main.h\n--- a/src/ui/Main.h\n+++ b/src/ui/Main.h\n@@ -1 +1 @@\n-a\n+b\n';
const DOC_DIFF = 'diff --git a/docs/notes.md b/docs/notes.md\n--- a/docs/notes.md\n+++ b/docs/notes.md\n@@ -1 +1 @@\n-a\n+b\n';
const STORE_DIFF = 'diff --git a/.ai/tickets/KIT-T1.md b/.ai/tickets/KIT-T1.md\n--- a/.ai/tickets/KIT-T1.md\n+++ b/.ai/tickets/KIT-T1.md\n@@ -1 +1 @@\n-a\n+b\n';
const heredoc = (head, body) => `${head} <<'EOF'\n${body}EOF`;
const AMBIGUOUS = "echo $'x' ; ";

try {
  const repo = tmpDir('kit-wrapped-');
  execFileSync('git', ['init', '-q'], { cwd: repo });
  mkdirSync(join(repo, '.ai'), { recursive: true });
  const scratch = tmpDir('kit scratch ').replace(/\\/g, '/');
  const inRepo = repo.replace(/\\/g, '/');
  const gate = (name, tool, command) => spawnSync(process.execPath, [join(HOOKS, name)], { cwd: repo, input: JSON.stringify({ tool_name: tool, tool_input: { command } }), encoding: 'utf8' }).status;
  const src = (command, tool = 'Bash') => gate('source-shell-gate.mjs', tool, command);
  const store = (command) => gate('store-shell-gate.mjs', 'Bash', command);

  const ambiguousBlocks = [
    ['sudo patch', heredoc('sudo patch -p1', SRC_DIFF)],
    ['timeout 5 patch', heredoc('timeout 5 patch -p0', SRC_DIFF)],
    ['env A=1 git apply', heredoc('env A=1 git apply', SRC_DIFF)],
    ['command git apply', heredoc('command git apply', SRC_DIFF)],
    ['sudo -u root git -C . apply', heredoc('sudo -u root git -C . apply', SRC_DIFF)],
    ['git -c k=v apply', heredoc('git -c k=v apply', SRC_DIFF)],
    ['a grouped { git apply; }', `${heredoc('{ git apply', SRC_DIFF)}; }`],
    ['a subshell ( git apply )', `${heredoc('( git apply', SRC_DIFF)} )`],
    ['then patch', `if true; then\n${heredoc('patch -p1', SRC_DIFF)}\nfi`],
    ['a command substitution', `x=$(git apply <<'EOF'\n${SRC_DIFF}EOF\n)`],
    ['git apply run from another command (find -exec)', heredoc('find . -name x -exec git apply', SRC_DIFF)],
    ['git apply run over ssh', heredoc('ssh host git apply', SRC_DIFF)],
    ['git apply in a trap string', "trap 'git apply x.patch' EXIT"],
    ['env A=1 echo git apply (git named anywhere)', 'env A=1 echo git apply'],
    ['bash -c patch', heredoc('bash -c "patch -p1"', SRC_DIFF)],
    ['bash -c sudo patch with a redirect', 'bash -c "sudo patch -p1 < x.patch"'],
    ['git apply --check (a flag cannot lift an untrusted line)', 'git apply --check x.patch'],
    ['a negated ! patch', heredoc('! patch -p1', SRC_DIFF)],
    ['then patch on one line', `if true; then ${heredoc('patch -p1', SRC_DIFF)}\nfi`],
  ];
  for (const [name, command] of ambiguousBlocks) ok(`ambiguous quoting: source gate blocks ${name}`, src(AMBIGUOUS + command) === BLOCK);
  ok('ambiguous quoting: store gate blocks sudo patch', store(AMBIGUOUS + heredoc('sudo patch -p1', STORE_DIFF)) === BLOCK);

  const ambiguousPasses = [
    ['echo patch', 'echo patch'],
    ['grep patch', 'grep patch f.txt'],
    ['sudo ls', 'sudo ls -la'],
    ['echo of the word apply', 'echo git status; echo apply'],
    ['bash -c echo patch', 'bash -c "echo patch"'],
    ['a commit message that mentions patch and apply', 'git commit -m "fix \\"patch\\" handling of apply"'],
  ];
  for (const [name, command] of ambiguousPasses) ok(`ambiguous quoting: source gate passes ${name}`, src(AMBIGUOUS + command) === PASS);

  const shellBlocks = [
    ['bash -c git apply', heredoc('bash -c "git apply"', SRC_DIFF)],
    ["sh -c 'patch -p1'", heredoc("sh -c 'patch -p1'", SRC_DIFF)],
    ['bash -lc sudo patch', heredoc('bash -lc "sudo patch -p1"', SRC_DIFF)],
    ['sudo bash -c git apply', heredoc('sudo bash -c "git apply"', SRC_DIFF)],
    ['env A=1 sh -c git apply', heredoc('env A=1 sh -c "git apply"', SRC_DIFF)],
    ['bash -c with cd && git apply', heredoc('bash -c "cd . && git apply"', SRC_DIFF)],
    ['a nested sh -c', heredoc('bash -c "sh -c \'git apply\'"', SRC_DIFF)],
    ['bash -c patch of a temp patch via redirect', heredoc('bash -c "patch -p1 < /nonexistent.patch"', SRC_DIFF)],
    ['pwsh -Command git apply', heredoc('pwsh -Command "git apply"', SRC_DIFF)],
    ['powershell -NoProfile -c git apply', heredoc('powershell -NoProfile -c "git apply"', SRC_DIFF)],
    ['eval git apply', heredoc('eval "git apply"', SRC_DIFF)],
    ['a negated ! patch', heredoc('! patch -p1', SRC_DIFF)],
    ['then patch on one line', `if true; then ${heredoc('patch -p1', SRC_DIFF)}\nfi`],
    ['do git apply on one line', `for i in 1; do ${heredoc('git apply', SRC_DIFF)}\ndone`],
    ['a grouped { patch; }', `${heredoc('{ patch -p1', SRC_DIFF)}; }`],
    ['bash -c git apply behind a pipe', `cat x | ${heredoc('bash -c "git apply"', SRC_DIFF)}`],
  ];
  for (const [name, command] of shellBlocks) ok(`source gate blocks ${name}`, src(command) === BLOCK);
  ok('source gate blocks bash -c git apply of a diff piped in', src(`printf '--- a/src/x.h\\n+++ b/src/x.h\\n' | bash -c "git apply"`) === BLOCK);
  ok('store gate blocks bash -c git apply of a store diff', store(heredoc('bash -c "git apply"', STORE_DIFF)) === BLOCK);

  const shellPasses = [
    ['bash -c git apply --check', heredoc('bash -c "git apply --check"', SRC_DIFF)],
    ['bash -c patch --dry-run', heredoc('bash -c "patch --dry-run -p1"', SRC_DIFF)],
    ['bash -c echo patch', 'bash -c "echo patch"'],
    ['bash -c git apply of a diff that names no source', heredoc('bash -c "git apply"', DOC_DIFF)],
    ['bash -c git am --abort', 'bash -c "git am --abort"'],
    ['bash -c grep patch', 'bash -c "grep -n patch src/ui/Main.h"'],
    ['bash script.sh (no -c string)', 'bash scripts/build.sh'],
    ['bash -c git status', 'bash -c "git status"'],
    ['eval echo', 'eval "echo patch"'],
  ];
  for (const [name, command] of shellPasses) ok(`source gate passes ${name}`, src(command) === PASS);

  const deepest = 'git apply';
  const nested = [1, 2, 3, 4, 5, 6].reduce((inner) => `bash -c '${inner.replace(/'/g, `'"'"'`)}'`, deepest);
  ok('nesting stops at a bounded depth without a crash', [BLOCK, PASS].includes(src(heredoc(nested, SRC_DIFF))));

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

  ok('appliesPatch: a reader of the word patch does not lead an applier', !appliesPatch('echo patch'));
  ok('appliesPatch: sudo patch leads one', appliesPatch('sudo patch -p1'));
} finally {
  cleanup();
}
done();
