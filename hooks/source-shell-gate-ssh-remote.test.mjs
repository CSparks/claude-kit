#!/usr/bin/env node
// source-shell-gate-ssh-remote.test.mjs — the quoted remote command of an ssh call runs on another machine, so its file
// operands are no local writes (KIT-T1471); a redirect or segment outside the quotes, a double-quoted string that runs a
// local substitution, and an ssh word that is no command still judge. A path whose parent is an existing file (the
// `docker-compose.yml/any.rs` of a copy) finds its repo from the nearest directory, never spawning git inside a file.
// Run: node hooks/source-shell-gate-ssh-remote.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitRootOfFile, gitRootOfFileChecked } from './lib/paths.mjs';
import { maskSshRemote } from './lib/ssh-remote-mask.mjs';

const HOOK = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const repo = mkdtempSync(join(tmpdir(), 'kit-sshremote-'));
const run = (command, tool = 'Bash') => spawnSync(process.execPath, [HOOK], { cwd: repo, input: JSON.stringify({ tool_name: tool, tool_input: { command } }), encoding: 'utf8' });
const blocked = (command, tool) => run(command, tool).status === 2;
const passes_ = (command, tool) => { const r = run(command, tool); return r.status === 0 ? '' : `exit=${r.status} ${r.stderr.slice(0, 160)}`; };

try {
  execFileSync('git', ['init', '-q'], { cwd: repo });
  mkdirSync(join(repo, '.ai'), { recursive: true });
  mkdirSync(join(repo, 'src'), { recursive: true });
  writeFileSync(join(repo, 'src', 'a.rs'), 'fn a() {}\n');
  writeFileSync(join(repo, 'docker-compose.yml'), 'services: {}\n');
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: repo, encoding: 'utf8' }).trim().replace(/\\/g, '/');

  const underFile = join(repo, 'docker-compose.yml', 'any.rs');
  let found = '';
  let foundLoose = '';
  try { found = gitRootOfFileChecked(underFile).replace(/\\/g, '/'); } catch (e) { found = `threw: ${e.message}`; }
  try { foundLoose = gitRootOfFile(underFile).replace(/\\/g, '/'); } catch (e) { foundLoose = `threw: ${e.message}`; }
  check('KIT-T1471: gitRootOfFileChecked finds the repo of a path whose parent is a file', found === root, found);
  check('KIT-T1471: gitRootOfFile finds the repo of a path whose parent is a file', foundLoose === root, foundLoose);

  const ticket = "ssh -i key root@host 'cd /root/autoaudit; cp docker-compose.yml docker-compose.yml.bak; sed -i s/a/b/ docker-compose.yml'";
  const PASSES = [
    ['the ticket command: cp and sed -i on a compose file inside the remote string', ticket],
    ['a remote rm of a source path', "ssh host 'rm hooks/x.mjs'"],
    ['a double-quoted remote cp of source files', 'ssh host "cp a.rs b.rs"'],
    ['a redirect inside the remote string', "ssh host 'cat x > src/a.rs'"],
    ['a remote sed -i on a source file', "ssh -p 22 -o StrictHostKeyChecking=no user@host 'sed -i s/a/b/ src/a.rs'"],
    ['a remote rm -rf of a directory that also exists locally', "ssh host 'rm -rf src'"],
    ['a remote git clean', "ssh host 'git clean -fd'"],
    ['ssh under a wrapper', "timeout 5 ssh host 'sed -i s/a/b/ src/a.rs'"],
    ['ssh with a quoted key path that holds a space', "ssh -i 'C:/Users/A B/.ssh/key' root@host 'rm src/a.rs'"],
    ['ssh inside a powershell -Command string', `powershell.exe -Command "ssh -i 'C:\\Users\\A B\\.ssh\\key' root@host 'cp a.rs b.rs; sed -i s/a/b/ src/a.rs'"`],
    ['ssh inside a bash -c string', `bash -c "ssh host 'rm src/a.rs'"`],
  ];
  for (const [name, command] of PASSES) check(`KIT-T1471: allows ${name}`, passes_(command) === '', passes_(command));
  check('KIT-T1471: allows the same ticket command from the PowerShell tool', passes_(ticket, 'PowerShell') === '', passes_(ticket, 'PowerShell'));

  const BLOCKS = [
    ['a redirect after the remote string', "ssh host 'ls' > src/a.rs"],
    ['a later segment after the remote string', "ssh host 'ls'; sed -i s/a/b/ src/a.rs"],
    ['a later segment inside a bash -c string', `bash -c "ssh host 'ls' ; sed -i s/a/b/ src/a.rs"`],
    ['an unquoted remote command', 'ssh host tee src/a.rs'],
    ['a double-quoted remote string with a local substitution', 'ssh host "echo $(cat > src/a.rs)"'],
    ['a double-quoted remote string with a local backtick substitution', 'ssh host "echo `rm src/a.rs`"'],
    ['an ssh word that is an operand of cp', "cp draft.rs ssh 'x' 'src/a.rs'"],
    ['a patch applied over ssh', "cat <<'EOF' | ssh host 'git apply'\n*** a/src/a.rs\n--- a/src/a.rs\n+++ b/src/a.rs\n@@ -1 +1 @@\n-fn a() {}\n+fn b() {}\nEOF"],
    ['a local rm with no ssh', 'rm src/a.rs'],
  ];
  for (const [name, command] of BLOCKS) check(`KIT-T1471 control: still blocks ${name}`, blocked(command), run(command).stderr.slice(0, 100));

  check('maskSshRemote: the remote operand is blanked and the length kept', maskSshRemote("ssh host 'rm a.rs'") === `ssh host ${' '.repeat("'rm a.rs'".length)}`);
  check('maskSshRemote: a command that is not ssh comes back unchanged', maskSshRemote("cp draft.rs ssh 'x'") === "cp draft.rs ssh 'x'");
  check('maskSshRemote: an unquoted remote command comes back unchanged', maskSshRemote('ssh host rm a.rs') === 'ssh host rm a.rs');
} finally {
  rmSync(repo, { recursive: true, force: true });
}
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
