#!/usr/bin/env node
// source-shell-gate-wrapped-runners-pass.test.mjs — the runner forms that apply nothing (a --check, a diff that names no source,
// a reader of the word patch, a substitution of git status, a single-quoted or escaped substitution) pass, the patch-runner
// scan names the ones that do, and nesting stops at a bounded depth (KIT-T1075). Split from source-shell-gate-wrapped.test.mjs
// so each suite finishes inside one foreground call (KIT-T1271).
// Run: node hooks/source-shell-gate-wrapped-runners-pass.test.mjs

import { appliesPatch } from './lib/patch-apply.mjs';
import { AMBIGUOUS, BLOCK, DOC_DIFF, PASS, SRC_DIFF, heredoc, printed, wrappedHarness } from './source-shell-gate-wrapped-harness.mjs';

const { ok, src, finish } = wrappedHarness('source-shell-gate-wrapped-runners-pass');

try {
  const runnerPasses = [
    ['find -exec git apply --check', heredoc('find . -maxdepth 0 -exec git apply --check', SRC_DIFF)],
    ['find -exec git apply --stat', heredoc('find . -maxdepth 0 -exec git apply --stat', SRC_DIFF)],
    ['find -exec patch --dry-run', heredoc('find . -maxdepth 0 -exec patch --dry-run -p1', SRC_DIFF)],
    ['find -exec git apply of a diff that names no source', heredoc('find . -maxdepth 0 -exec git apply', DOC_DIFF)],
    ['find by the name patch', `${printed(SRC_DIFF)}; find . -name patch`],
    ['find grepping for patch', `${printed(SRC_DIFF)}; find . -name '*.patch' -exec grep -l patch {} \\;`],
    ['find -exec ls', `${printed(SRC_DIFF)}; find . -exec ls {} \\;`],
    ['ssh host git apply --cached', heredoc('ssh host git apply --cached', SRC_DIFF)],
    ['ssh host git am --abort', `${printed(SRC_DIFF)}; ssh host 'git am --abort'`],
    ['ssh host patch --dry-run', heredoc('ssh host patch --dry-run -p1', SRC_DIFF)],
    ['ssh host ls', `${printed(SRC_DIFF)}; ssh host ls`],
    ['ssh host grep patch', `${printed(SRC_DIFF)}; ssh host "grep -n patch f"`],
    ['ssh with no remote command', `${printed(SRC_DIFF)}; ssh host`],
    ['a trap that removes a file', `${printed(SRC_DIFF)}; trap 'rm -f /tmp/x' EXIT`],
    ['a trap that echoes patch', `${printed(SRC_DIFF)}; trap 'echo patch' EXIT`],
    ['a trap git apply --check', `${printed(SRC_DIFF)}; trap 'git apply --check' EXIT`],
    ['trap -', `${printed(SRC_DIFF)}; trap - EXIT`],
    ['trap -p', `${printed(SRC_DIFF)}; trap -p`],
    ['a substitution of git apply --check', `echo $(git apply --check <<'EOF'\n${SRC_DIFF}EOF\n)`],
    ['a substitution of git apply of a diff that names no source', `echo $(git apply <<'EOF'\n${DOC_DIFF}EOF\n)`],
    ['a substitution of git status', `${printed(SRC_DIFF)}; echo $(git status)`],
    ['a substitution of command -v git', `${printed(SRC_DIFF)}; echo $(command -v git)`],
    ['a substitution of grep patch', `${printed(SRC_DIFF)}; echo $(grep -n patch f)`],
    ['a single-quoted substitution', `${printed(SRC_DIFF)}; echo '$(git apply)'`],
    ['an escaped substitution', `${printed(SRC_DIFF)}; echo \\$(git apply)`],
    ['arithmetic', `${printed(SRC_DIFF)}; echo $((1 + 2))`],
    ['a substitution of git rev-parse', `${printed(SRC_DIFF)}; ls $(git rev-parse --show-toplevel)/src`],
    ['a commit message that names git apply', `${printed(SRC_DIFF)}; git commit -m "fix git apply"`],
    ['git format-patch', `${printed(SRC_DIFF)}; git format-patch -1`],
    ['su with no -c', `${printed(SRC_DIFF)}; su root`],
  ];
  for (const [name, command] of runnerPasses) ok(`source gate passes ${name}`, src(command) === PASS);
  const ambiguousRunnerPasses = ['find . -name patch', 'ssh host ls', "trap 'echo x' EXIT", 'echo $(grep -n patch f)', 'echo $(command -v git)'];
  for (const command of ambiguousRunnerPasses) ok(`ambiguous quoting: source gate passes ${command}`, src(AMBIGUOUS + command) === PASS);

  const patchRunners = ['find . -exec patch -p1 -i x \\;', 'ssh host patch -p1 < x', "ssh host 'patch -p1'", "trap 'patch -p1' EXIT", 'echo $(patch -p1)', "su -c 'patch -p1'", 'sudo find . -exec patch -p1 \\;'];
  for (const command of patchRunners) ok(`appliesPatch: ${command} runs patch`, appliesPatch(command));
  ok('appliesPatch: a find that only names patch does not run it', !appliesPatch('find . -name patch'));
  ok('appliesPatch: an ssh to a host named patch runs nothing', !appliesPatch('ssh patch'));

  const substitutionTower = [1, 2, 3, 4, 5, 6].reduce((inner) => `echo $(${inner})`, 'git apply');
  ok('substitution nesting stops at a bounded depth without a crash', [BLOCK, PASS].includes(src(heredoc(substitutionTower, SRC_DIFF))));

  const deepest = 'git apply';
  const nested = [1, 2, 3, 4, 5, 6].reduce((inner) => `bash -c '${inner.replace(/'/g, `'"'"'`)}'`, deepest);
  ok('nesting stops at a bounded depth without a crash', [BLOCK, PASS].includes(src(heredoc(nested, SRC_DIFF))));

  ok('appliesPatch: a reader of the word patch does not lead an applier', !appliesPatch('echo patch'));
  ok('appliesPatch: sudo patch leads one', appliesPatch('sudo patch -p1'));
} finally {
  finish();
}
