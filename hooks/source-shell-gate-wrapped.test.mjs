#!/usr/bin/env node
// source-shell-gate-wrapped.test.mjs — three escapes of the shell write gates (KIT-T1075):
//   1. an applier behind a wrapper (`sudo`, `env A=1`, `timeout 5`) or a grouping word in a command whose quoting
//      cannot be trusted is judged by the same lead scan as a plain one;
//   2. an applier inside `bash -c "..."`, `sh -lc`, `pwsh -Command` or `eval` is judged by the same rules;
//   3. a cp whose destination holds a variable the command assigns once, literally, before use is judged by where it lands.
// Every control that stays blocked is a variable or applier the gate cannot prove harmless.
// This file judges escapes 1 and 2 behind a wrapper or a shell; the runners (find, ssh, trap, substitutions) are
// source-shell-gate-wrapped-runners.test.mjs and -runners-pass.test.mjs, the cp forms source-shell-gate-wrapped-copies.test.mjs,
// split so each finishes inside one foreground call (KIT-T1271).
// Run: node hooks/source-shell-gate-wrapped.test.mjs

import { AMBIGUOUS, BLOCK, DOC_DIFF, PASS, SRC_DIFF, STORE_DIFF, heredoc, wrappedHarness } from './source-shell-gate-wrapped-harness.mjs';

const { ok, src, store, finish } = wrappedHarness('source-shell-gate-wrapped');

try {
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
} finally {
  finish();
}
