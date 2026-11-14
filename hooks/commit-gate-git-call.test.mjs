// commit-gate recognises a commit by parsing the git call, so a quoted `-C` path with a space, several `-C`, git's other
// global options, a `cd` into the repo, a shell string and PowerShell quoting all reach the gate's judgement (KIT-T1174).
// Run: node hooks/commit-gate-git-call.test.mjs

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { adopted, git, hook, reporter, repo, tmpDir, cleanup } from './test-harness.mjs';
import { sameCommandAdds } from './lib/commit-files.mjs';

const { ok, done } = reporter('commit-gate-git-call');
const BLOCKED = 2;
const ALLOWED = 0;
const CITED = 'x (implements KIT-T1174)';

try {
  const parent = tmpDir('kit spaced parent-').replace(/\\/g, '/');
  const target = `${parent}/my repo`;
  mkdirSync(target);
  git(['init', '-q'], target);
  mkdirSync(join(target, '.ai'));
  writeFileSync(join(target, 'foo.ts'), 'function f() { return doStuff(42); }\n');
  writeFileSync(join(target, 'docs.md'), 'notes\n');
  git(['add', 'foo.ts'], target);
  const plain = adopted(true).replace(/\\/g, '/');
  const elsewhere = repo();

  const gate = (command, tool = 'Bash') => hook('commit-gate.mjs', { tool_name: tool, tool_input: { command } }, elsewhere).code;
  const judged = (label, command, tool) => ok(`blocks uncited code: ${label}`, gate(command, tool) === BLOCKED);

  judged('git -C "<dir with a space>" commit', `git -C "${target}" commit -m "x"`);
  judged('git -C with single quotes', `git -C '${target}' commit -m x`);
  judged('git -C <unquoted dir> commit', `git -C ${plain} commit -m x`);
  judged('cd <unquoted dir> && git commit', `cd ${plain} && git commit -m x`);
  judged('two -C: the second is relative to the first', `git -C "${parent}" -C "my repo" commit -m x`);
  judged('-c key=value before -C', `git -c core.autocrlf=false -C "${target}" commit -m x`);
  judged('--no-pager before -C', `git --no-pager -C "${target}" commit -m x`);
  judged('-C after another global flag', `git -P -C "${target}" commit -q -m x`);
  judged('git.exe', `git.exe -C "${target}" commit -m x`);
  judged('a quoted git.exe path with a space', `"C:/Program Files/Git/cmd/git.exe" -C "${target}" commit -m x`);
  judged('cd "<dir with a space>" && git commit', `cd "${target}" && git commit -m x`);
  judged('cd into the parent, then git -C <relative with a space>', `cd "${parent}" && git -C "my repo" commit -m x`);
  judged('an env assignment before git', `GIT_EDITOR=true git -C "${target}" commit -m x`);
  judged('inside bash -c', `bash -c 'git -C "${target}" commit -m x'`);
  judged('inside bash -c after a cd', `bash -c 'cd "${target}" && git commit -m x'`);
  judged('PowerShell single-quoted path', `git -C '${target}' commit -m x`, 'PowerShell');
  judged('PowerShell -Command string', `powershell -Command "git -C '${target}' commit -m x"`, 'PowerShell');
  judged('a commit that follows other commands', `echo start && git -C "${target}" status && git -C "${target}" commit -m x`);
  judged('a message holding an arrow and a redirect sign', `git -C "${target}" commit -m "a -> b > c"`);

  ok('a cited commit passes', gate(`git -C "${target}" commit -m "${CITED}"`) === ALLOWED);
  ok('[no-log: reason] passes', gate(`git -C "${target}" commit -m "x [no-log: scratch]"`) === ALLOWED);
  ok('a by-path commit of a document judges that path, past a message with an arrow', gate(`git -C "${target}" commit -m "a -> b" -- docs.md`) === ALLOWED);

  ok('control: git -C "<dir>" log is not a commit', gate(`git -C "${target}" log`) === ALLOWED);
  ok('control: git -C "<dir>" status is not a commit', gate(`git -C "${target}" status`) === ALLOWED);
  ok('control: a log whose --grep holds the word commit is not a commit', gate(`git -C "${target}" log --grep="git commit"`) === ALLOWED);
  ok('control: echoing the words git commit is not a commit', gate(`echo "git -C ${target} commit -m x"`) === ALLOWED);
  ok('control: git commit-tree is a different subcommand', gate(`git -C "${target}" commit-tree HEAD`) === ALLOWED);

  ok('sameCommandAdds reads add -A behind a quoted -C path', sameCommandAdds(`git -C "${target}" add -A`).includes('.'));
  ok('control: sameCommandAdds ignores status behind a quoted -C path', sameCommandAdds(`git -C "${target}" status`).length === 0);
} finally {
  cleanup();
}

done();
