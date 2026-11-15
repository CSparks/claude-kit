// Shared setup of the source-shell-gate-wrapped suites (KIT-T1075): a throwaway adopted repo, a scratch directory with a space
// in its name, and the calls that drive the source and store gates. The suites are split so each finishes inside one foreground call.
//
//   wrappedHarness(name) -> { ok, finish, src, store, scratch, inRepo, BLOCK, PASS, SRC_DIFF, DOC_DIFF, STORE_DIFF, AMBIGUOUS, heredoc, printed }
//     src(command, tool) / store(command) -> the exit status of the gate; finish() removes the repo and prints the totals

import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnHookChecked } from './spawn-hook-checked.mjs';
import { cleanup, reporter, tmpDir } from './test-harness.mjs';

const HOOKS = fileURLToPath(new URL('.', import.meta.url));

export const BLOCK = 2;
export const PASS = 0;
export const SRC_DIFF = 'diff --git a/src/ui/Main.h b/src/ui/Main.h\n--- a/src/ui/Main.h\n+++ b/src/ui/Main.h\n@@ -1 +1 @@\n-a\n+b\n';
export const DOC_DIFF = 'diff --git a/docs/notes.md b/docs/notes.md\n--- a/docs/notes.md\n+++ b/docs/notes.md\n@@ -1 +1 @@\n-a\n+b\n';
export const STORE_DIFF = 'diff --git a/.ai/tickets/KIT-T1.md b/.ai/tickets/KIT-T1.md\n--- a/.ai/tickets/KIT-T1.md\n+++ b/.ai/tickets/KIT-T1.md\n@@ -1 +1 @@\n-a\n+b\n';
export const AMBIGUOUS = "echo $'x' ; ";
export const heredoc = (head, body) => `${head} <<'EOF'\n${body}EOF`;
export const printed = (diff) => `printf '${diff.replace(/\n/g, '\\n')}'`;

export function wrappedHarness(name) {
  const { ok, done } = reporter(name);
  const repo = tmpDir('kit-wrapped-');
  execFileSync('git', ['init', '-q'], { cwd: repo });
  mkdirSync(join(repo, '.ai'), { recursive: true });
  const scratch = tmpDir('kit scratch ').replace(/\\/g, '/');
  const inRepo = repo.replace(/\\/g, '/');
  const gate = (script, tool, command) => spawnHookChecked(join(HOOKS, script), { cwd: repo, input: JSON.stringify({ tool_name: tool, tool_input: { command } }), encoding: 'utf8' }).status;
  return {
    ok,
    scratch,
    inRepo,
    src: (command, tool = 'Bash') => gate('source-shell-gate.mjs', tool, command),
    store: (command) => gate('store-shell-gate.mjs', 'Bash', command),
    finish: () => { cleanup(); done(); },
  };
}
