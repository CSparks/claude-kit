#!/usr/bin/env node
// source-shell-gate-wrapped-runners.test.mjs — an applier run by another command (find -exec, ssh, su -c, a trap string, a
// command or process substitution, bash -c) is judged like one typed alone, with the quoting trusted and not (KIT-T1075).
// Split from source-shell-gate-wrapped.test.mjs so each suite finishes inside one foreground call (KIT-T1271).
// Run: node hooks/source-shell-gate-wrapped-runners.test.mjs

import { AMBIGUOUS, BLOCK, SRC_DIFF, STORE_DIFF, heredoc, printed, wrappedHarness } from './source-shell-gate-wrapped-harness.mjs';

const { ok, src, store, finish } = wrappedHarness('source-shell-gate-wrapped-runners');

try {
  const runnerBlocks = [
    ['find -exec git apply', heredoc('find . -maxdepth 0 -exec git apply', SRC_DIFF)],
    ['find -execdir patch', heredoc('find . -maxdepth 0 -execdir patch -p1', SRC_DIFF)],
    ['find -ok git am', heredoc('find . -maxdepth 0 -ok git am', SRC_DIFF)],
    ['find -exec git apply +', heredoc('find . -maxdepth 0 -exec git apply +', SRC_DIFF)],
    ['the second -exec clause of find', heredoc('find . -name x -exec echo {} \\; -exec git apply', SRC_DIFF)],
    ['sudo find -exec git apply', heredoc('sudo find . -maxdepth 0 -exec git apply', SRC_DIFF)],
    ['find -exec sh -c git apply', heredoc("find . -maxdepth 0 -exec sh -c 'git apply' \\;", SRC_DIFF)],
    ['ssh host git apply', heredoc('ssh host git apply', SRC_DIFF)],
    ['ssh with value options', heredoc('ssh -p 22 -i key -o StrictHostKeyChecking=no user@host git apply', SRC_DIFF)],
    ['ssh with a quoted remote command', heredoc("ssh host 'git apply'", SRC_DIFF)],
    ['ssh with a quoted compound remote command', heredoc('ssh host "cd /x && git apply"', SRC_DIFF)],
    ['ssh host patch', heredoc('ssh host patch -p1', SRC_DIFF)],
    ['ssh host sudo git apply', heredoc('ssh host sudo -u root git apply', SRC_DIFF)],
    ['timeout 5 ssh host git apply', heredoc('timeout 5 ssh host git apply', SRC_DIFF)],
    ['trap string git apply', `${printed(SRC_DIFF)}; trap 'git apply' EXIT`],
    ['trap string with several signals', `${printed(SRC_DIFF)}; trap "git apply" EXIT INT`],
    ['trap string with a compound command', `${printed(SRC_DIFF)}; trap 'cd /x; patch -p1' ERR`],
    ['env A=1 trap string', `${printed(SRC_DIFF)}; env A=1 trap 'git apply' EXIT`],
    ['su -c git apply', heredoc("su -c 'git apply' root", SRC_DIFF)],
    ['the ticket shape: a heredoc inside a command substitution', `echo $(git apply <<'EOF'\n${SRC_DIFF}EOF\n)`],
    ['a double-quoted command substitution', `echo "$(git apply <<'EOF'\n${SRC_DIFF}EOF\n)"`],
    ['an assigned command substitution of patch', `x=$(patch -p1 <<'EOF'\n${SRC_DIFF}EOF\n)`],
    ['a backtick substitution', `echo \`git apply <<'EOF'\n${SRC_DIFF}EOF\n\``],
    ['a process substitution', `cat <(git apply <<'EOF'\n${SRC_DIFF}EOF\n)`],
    ['a substitution holding ssh', `${printed(SRC_DIFF)}; echo $(ssh host git apply)`],
    ['a substitution in a commit message', `${printed(SRC_DIFF)}; git commit -m "x $(git apply)"`],
    ['a substitution inside a trap string', `${printed(SRC_DIFF)}; trap 'echo $(git apply)' EXIT`],
    ['bash -c holding ssh', `${printed(SRC_DIFF)}; bash -c 'ssh host git apply'`],
    ['bash -c holding find -exec', `${printed(SRC_DIFF)}; bash -c 'find . -exec git apply \\;'`],
  ];
  for (const [name, command] of runnerBlocks) ok(`source gate blocks ${name}`, src(command) === BLOCK);
  for (const [name, command] of runnerBlocks) ok(`ambiguous quoting: source gate blocks ${name}`, src(AMBIGUOUS + command) === BLOCK);
  ok('store gate blocks find -exec git apply of a store diff', store(heredoc('find . -maxdepth 0 -exec git apply', STORE_DIFF)) === BLOCK);
  ok('store gate blocks ssh host git apply of a store diff', store(heredoc('ssh host git apply', STORE_DIFF)) === BLOCK);
  ok('store gate blocks a substitution holding git apply of a store diff', store(`echo $(git apply <<'EOF'\n${STORE_DIFF}EOF\n)`) === BLOCK);
  ok('store gate blocks a trap string holding git apply of a store diff', store(`${printed(STORE_DIFF)}; trap 'git apply' EXIT`) === BLOCK);
} finally {
  finish();
}
