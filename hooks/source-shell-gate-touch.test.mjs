#!/usr/bin/env node
// source-shell-gate-touch.test.mjs — a `touch` that only stamps the mtime of an existing source file authors no
// content and passes (KIT-T1088); creating a source file, a glob, an unresolved variable, any other option and every
// other segment of the command stay judged as today.
// Run: node hooks/source-shell-gate-touch.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const repo = mkdtempSync(join(tmpdir(), 'kit-touch-'));
const run = (command, tool = 'Bash', cwd = repo) => spawnSync(process.execPath, [HOOK], { cwd, input: JSON.stringify({ tool_name: tool, tool_input: { command } }), encoding: 'utf8' });
const blocked = (command, tool) => {
  const r = run(command, tool);
  return r.status === 2 && /source-shell-write/.test(r.stderr);
};
const passes_ = (command, tool) => run(command, tool).status === 0;

try {
  execFileSync('git', ['init', '-q'], { cwd: repo });
  mkdirSync(join(repo, '.ai'), { recursive: true });
  mkdirSync(join(repo, 'src', 'state'), { recursive: true });
  for (const f of ['src/state/AppState.h', 'src/a.cpp', 'src/b.cpp', 'src/ref.h']) writeFileSync(join(repo, f), 'x\n');
  const scratch = join(tmpdir(), 'kit-touch-copy.cpp').replace(/\\/g, '/');

  const PASS = [
    ['the ticket command', 'touch src/state/AppState.h'],
    ['the ticket command under PowerShell', 'touch src/state/AppState.h', 'PowerShell'],
    ['-m', 'touch -m src/a.cpp'],
    ['-a and -m clustered', 'touch -am src/a.cpp'],
    ['-c of an existing file', 'touch -c src/a.cpp'],
    ['-d with a quoted date', 'touch -d "2020-01-01 00:00" src/a.cpp'],
    ['-t with a stamp', 'touch -t 202001010000 src/a.cpp'],
    ['-r with a reference file', 'touch -r src/ref.h src/a.cpp'],
    ['--date=', 'touch --date=2020-01-01 src/a.cpp'],
    ['--date with a separate value', 'touch --date "2 hours ago" src/a.cpp'],
    ['--reference=', 'touch --reference=src/ref.h src/a.cpp'],
    ['several existing files', 'touch src/a.cpp src/b.cpp src/state/AppState.h'],
    ['an absolute path to an existing file', `touch ${join(repo, 'src', 'a.cpp').replace(/\\/g, '/')}`],
    ['cd into the repo then a relative touch', `cd ${repo.replace(/\\/g, '/')} && touch src/a.cpp`],
    ['a touch and a build in one command', 'touch src/state/AppState.h && echo timing'],
    ['an assigned variable operand', 'D=src && touch $D/a.cpp'],
    ['an echo before the touch', 'echo stamping && touch src/a.cpp'],
    ['a cd into a subdirectory before the touch', 'cd src && touch a.cpp'],
    ['two touches in a row', 'touch src/a.cpp && touch src/b.cpp'],
    ['a missing file under -c (creates nothing)', 'touch -c src/missing.cpp'],
    ['a missing file under --no-create', 'touch --no-create src/missing.cpp'],
    ['a missing file under -c clustered with -m', 'touch -cm src/missing.cpp'],
    ['a missing non-source file', 'touch notes.txt'],
    ['a file named touch beside an existing source file', 'touch touch src/a.cpp'],
    ['a scratch source file', `touch ${scratch}`],
  ];
  for (const [name, command, tool] of PASS) check(`passes: ${name}`, passes_(command, tool), run(command, tool).stderr.slice(0, 120));

  const BLOCK = [
    ['a source file that does not exist', 'touch src/new.cpp'],
    ['a missing source file next to an existing one', 'touch src/a.cpp src/new.cpp'],
    ['a missing source file with -m only', 'touch -m src/new.cpp'],
    ['a missing source file with -d', 'touch -d "2020-01-01" src/new.cpp'],
    ['a glob operand', 'touch src/*.cpp'],
    ['a bracket glob', 'touch src/[ab].cpp'],
    ['a brace expansion', 'touch src/{a,new}.cpp'],
    ['an unresolved variable', 'touch $UNSET/a.cpp'],
    ['a braced unresolved variable', 'touch ${UNSET}/a.cpp'],
    ['a command substitution', 'touch $(echo src/a.cpp)'],
    ['a backtick substitution', 'touch `echo src/a.cpp`'],
    ['a variable assigned twice', 'D=src; D=lib; touch $D/a.cpp'],
    ['a conditionally assigned variable', 'true || D=src; touch $D/a.cpp'],
    ['an option outside the allowlist (-h)', 'touch -h src/a.cpp'],
    ['a glued -d value', 'touch -d2020-01-01 src/a.cpp'],
    ['an abbreviated long option', 'touch --no-c src/a.cpp'],
    ['a quoted option', 'touch "-m" src/a.cpp'],
    ['a substitution inside the -d value', 'touch -d "$(date)" src/a.cpp'],
    ['a stdin-less operand dash', 'touch - src/a.cpp'],
    ['no operand but a reference source', 'touch -r src/ref.cpp'],
    ['an unquoted backslash path', 'touch src\\a.cpp'],
    ['a touch with a redirect to a source file', 'touch src/a.cpp > src/b.cpp'],
    ['touch led by a wrapper', 'sudo touch src/a.cpp'],
    ['touch run through ssh', 'ssh host touch src/a.cpp'],
    ['touch run through bash -c', `bash -c "touch src/a.cpp"`],
    ['PowerShell New-Item', 'New-Item src/new.cpp', 'PowerShell'],
    ['a touch with a comma list under PowerShell', 'touch src/a.cpp,src/b.cpp', 'PowerShell'],
  ];
  for (const [name, command, tool] of BLOCK) check(`blocks: ${name}`, blocked(command, tool), run(command, tool).stderr.slice(0, 120));

  const SEGMENTS = [
    ['a second segment redirects into the touched file', 'touch src/a.cpp && echo x > src/a.cpp'],
    ['a second segment appends to the touched file', 'touch src/a.cpp; echo x >> src/a.cpp'],
    ['a second segment of tee', 'touch src/a.cpp && echo x | tee src/a.cpp'],
    ['a second segment of sed -i', "touch src/a.cpp && sed -i 's/x/y/' src/a.cpp"],
    ['-c does not lift a following write', 'touch -c src/a.cpp && echo x > src/a.cpp'],
    ['a write before the touch', 'echo x > src/a.cpp && touch src/a.cpp'],
    ['a second touch that creates', 'touch src/a.cpp && touch src/new.cpp'],
    ['a copy before the touch moves the file away', `mv src/a.cpp ${scratch} && touch src/a.cpp`],
    ['touch of a file the command deletes', 'rm src/a.cpp && touch src/a.cpp'],
    ['a move with a differently spelled path before the touch', `mv ./src/a.cpp ${scratch} && touch src/a.cpp`],
    ['a directory removed and recreated before the touch', 'rm -rf src && mkdir src && touch src/a.cpp'],
    ['git rm before the touch', 'git rm src/a.cpp && touch src/a.cpp'],
    ['a substitution that deletes, before the touch', 'echo $(rm src/a.cpp) && touch src/a.cpp'],
    ['a backtick substitution that deletes, before the touch', 'echo `find src -delete` && touch src/a.cpp'],
    ['a find -delete substitution in an assignment, before the touch', 'D=$(find src -delete) && touch src/a.cpp'],
    ['an assignment that deletes, before the touch', 'D=$(rm -rf src) && touch src/a.cpp'],
    ['a directory change after the touch', 'touch src/a.cpp && cd lib'],
    ['a pushd before the touch', 'pushd lib && touch src/a.cpp'],
    ['a pipeline before the touch', 'echo x | xargs rm && touch src/a.cpp'],
  ];
  for (const [name, command] of SEGMENTS) check(`blocks: ${name}`, blocked(command), run(command).stderr.slice(0, 120));
  check('the move alone still passes', passes_(`mv src/b.cpp ${scratch}`));
  check('two touches of the same existing file pass', passes_('touch src/a.cpp && touch src/a.cpp'));
} finally {
  rmSync(repo, { recursive: true, force: true });
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
