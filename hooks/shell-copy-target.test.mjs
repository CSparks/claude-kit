#!/usr/bin/env node
// shell-copy-target.test.mjs — KIT-T984 and the fail-closed rule for copies and moves. source-shell-gate lifts a
// cp/mv/Copy-Item/Move-Item of a source file only when the command has the one strict shape (shell-copy-target.mjs)
// AND its destination provably lands outside the repo; every other copy or move judges every operand as a write, and
// every hit of a command is judged on its own, so one proven move never excuses the rest of the line.
// The table is run through the real gate in a repo holding src/ (a directory), src/a.cpp, dir/c.cpp, a/b.cpp, x.cpp.
// Run: node hooks/shell-copy-target.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyTargets } from './lib/shell-copy-target.mjs';

const HOOK = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};

const repo = mkdtempSync(join(tmpdir(), 'kit-copytarget-'));
execFileSync('git', ['init', '-q'], { cwd: repo });
mkdirSync(join(repo, '.ai'), { recursive: true });
for (const file of ['src/a.cpp', 'dir/c.cpp', 'a/b.cpp', 'x.cpp']) {
  mkdirSync(join(repo, file, '..'), { recursive: true });
  writeFileSync(join(repo, file), 'int x;\n');
}
const run = (command) => spawnSync(process.execPath, [HOOK], { cwd: repo, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });
const allows = (name, command) => check(`allows ${name}`, run(command).status === 0, command);
const blocks = (name, command) => check(`blocks ${name}`, run(command).status === 2, command);

const temp = tmpdir().replace(/\\/g, '/');
const spaced = `${temp}/Chris Sparks/scratchpad`;
const msys = temp.replace(/^([A-Za-z]):\//, (_, d) => `/${d.toLowerCase()}/`);
const EN_DASH = '–';
const EM_DASH = '—';
const BAR = '―';

const ALLOWED = [
  ['KIT-T984: a quoted scratchpad path holding a space', `cp src/a.cpp "${spaced}/a.cpp"`],
  ['a single-quoted scratchpad path holding a space', `cp src/a.cpp '${spaced}/a.cpp'`],
  ['a copy into the temp dir', `cp src/a.cpp ${temp}/a.cpp`],
  ['a copy into the MSYS drive form', `cp src/a.cpp ${msys}/a.cpp`],
  ['a copy into a quoted MSYS path with a space', `cp src/a.cpp "${msys}/Chris Sparks/a.cpp"`],
  ['cp -p, -f and -v', `cp -p -f -v src/a.cpp ${temp}/a.cpp`],
  ['cp -t DIR', `cp -t ${temp} src/a.cpp`],
  ['cp --target-directory=DIR', `cp --target-directory=${temp} src/a.cpp`],
  ['cp --target-directory DIR', `cp --target-directory ${temp} src/a.cpp`],
  ['a copy with stderr merged and stdout to the null device', `cp src/a.cpp ${temp}/a.cpp > /dev/null 2>&1`],
  ['a move out to a new temp file', `mv src/a.cpp ${temp}/a.cpp`],
  ['a move to a path outside any repo', 'mv src/a.cpp ../moved.bak'],
  ['Copy-Item with positional Path and Destination', `Copy-Item src/a.cpp "${spaced}/a.cpp"`],
  ['Copy-Item with -Path, -Destination and -Force', `Copy-Item -Path src/a.cpp -Destination "${spaced}/a.cpp" -Force`],
  ['Copy-Item with -destination:value in lower case', `Copy-Item src/a.cpp -destination:"${spaced}/a.cpp"`],
  ['Move-Item out to the temp dir', `Move-Item src/a.cpp "${spaced}/a.cpp"`],
  ['a proven move, then a read-only command', `mv src/a.cpp ${temp}/a.cpp && git status`],
];
for (const [name, command] of ALLOWED) allows(name, command);

const BLOCKED = [
  ['cp x.cpp into an existing directory named without a slash', 'cp x.cpp src'],
  ['mv into an existing directory named without a slash (judged as src/a.cpp)', 'mv src/a.cpp src'],
  ['a move into the existing temp directory named without a slash', `mv src/a.cpp ${temp}`],
  ['a recursive copy of a directory', 'cp -r dir src'],
  ['cp -R', 'cp -R dir src'],
  ['cp -a', 'cp -a dir src'],
  ['cp --recursive', 'cp --recursive dir src'],
  ['cp --parents', 'cp --parents a/b.cpp src'],
  ['a symbolic link copy', 'cp -s x.cpp src/y.cpp'],
  ['a hard link copy', 'cp -l x.cpp src/y.cpp'],
  ['--link', 'cp --link x.cpp src/y.cpp'],
  ['--symbolic-link', 'cp --symbolic-link x.cpp src/y.cpp'],
  ['an option cluster', 'cp -rf dir src'],
  ['an unquoted backslash escape in the destination', `cp ${temp}/x.cpp src\\/a.cpp`],
  ['an unquoted escaped space', `cp x.cpp src\\ ${temp}/a.cpp`],
  ['a glob source', `cp src/*.cpp ${temp}/`],
  ['a variable destination', 'cp src/a.cpp "$DEST/a.cpp"'],
  ['an unquoted variable destination', 'cp src/a.cpp $DEST'],
  ['a brace expansion', `cp src/a.cpp ${temp}/{a,b}.cpp`],
  ['a command substitution', 'cp src/a.cpp "$(pwd)/a.cpp"'],
  ['a copy onto a source file', `cp ${temp}/x.cpp src/a.cpp`],
  ['a copy between source files', 'cp src/a.cpp src/b.cpp'],
  ['a backup next to the original inside the repo', 'cp src/a.cpp src/a.cpp.bak'],
  ['a move inside the repo', 'mv src/a.cpp src/a.cpp.bak'],
  ['a move onto a source file', `mv ${temp}/x.cpp src/a.cpp`],
  ['cp -t into the repo', `cp -t src ${temp}/x.cpp`],
  ['a joined -tDIR into the repo', `cp -tsrc/ ${temp}/x.cpp`],
  ['a clustered -rtDIR into the repo', `cp -rtsrc/ ${temp}/x.cpp`],
  ['an abbreviated --target= into the repo', `cp --target=src/ ${temp}/x.cpp`],
  ['a quoted option', `cp "--target-directory=src/" ${temp}/x.cpp`],
  ['a quoted dash token', `cp "-t" src ${temp}/x.cpp`],
  ['a -t with no value', `cp ${temp}/x.cpp src/a.cpp -t`],
  ['an option that may take a value after the operands', `cp ${temp}/x.cpp src/a.cpp --sparse always`],
  ['an unknown short option', `cp -Q ${temp}/x.cpp src/a.cpp`],
  ['install', `install -m 755 x.cpp ${temp}/x.cpp`],
  ['a quoted > in the first operand, then a source destination', `cp "${temp}/x>" ${temp}/a.cpp "src/"`],
  ['the move-then-write line: a proven move does not excuse the next copy', `mv src/a.cpp ${temp}/a.cpp; cp ${temp}/evil.cpp src/b.cpp`],
  ['the move-then-redirect line', `mv src/a.cpp ${temp}/a.cpp; echo hi > src/c.cpp`],
  ['the copy-then-sed line', `cp src/a.cpp ${temp}/a.cpp && sed -i s/a/b/ src/a.cpp`],
  ['a move whose destination the shell expands', 'mv src/a.cpp "$DEST/a.cpp.bak"'],
  ['Copy-Item onto a source file', `Copy-Item ${temp}/x.cpp -Destination src/b.cpp`],
  ['Copy-Item with an abbreviated -Dest', `Copy-Item src/a.cpp -Dest "${spaced}/a.cpp"`],
  ['Copy-Item with an ambiguous -De', `Copy-Item ${temp}/x.cpp -De src/b.cpp`],
  ['Copy-Item -Recurse', 'Copy-Item -Recurse dir src'],
  ['Copy-Item -Container', 'Copy-Item -Container dir src'],
  ['Copy-Item with a backtick escape', `Copy-Item ${temp}/x.cpp src/a\`.cpp`],
  ['Copy-Item with a comma list of sources', `Copy-Item x.cpp,dir/c.cpp ${temp}`],
  ['Copy-Item with an unknown parameter', `Copy-Item ${temp}/x.cpp src/b.cpp -Bogus`],
  ['Copy-Item with an en dash parameter', `Copy-Item ${temp}/x.cpp ${EN_DASH}Destination src/y.cpp`],
  ['Copy-Item with an em dash parameter', `Copy-Item ${temp}/x.cpp ${EM_DASH}Destination src/y.cpp`],
  ['Copy-Item with a horizontal bar parameter', `Copy-Item ${temp}/x.cpp ${BAR}Destination src/y.cpp`],
  ['cp with an en dash option', `cp ${EN_DASH}t src ${temp}/x.cpp`],
  ['a non-ASCII character in an unquoted destination', `cp src/a.cpp ${temp}/café/a.cpp`],
];
for (const [name, command] of BLOCKED) blocks(name, command);
blocks('rm of a source file', 'rm src/a.cpp');

const proven = (tool, args) => copyTargets(tool, args).proven;
check('the strict grammar proves the one plain shape', proven('cp', `src/a.cpp ${temp}/a.cpp`)?.destination === `${temp}/a.cpp`);
check('-t DIR names DIR/<source name>', proven('cp', `-t ${temp} src/a.cpp`)?.destination === `${temp}/a.cpp`);
check('the strict grammar refuses -a', proven('cp', `-a dir ${temp}/d`) === null);
check('the strict grammar refuses install', proven('install', `x.cpp ${temp}/x.cpp`) === null);
check('the strict grammar lands a trailing-slash destination at DIR/<name>', proven('cp', `x.cpp ${temp}/`)?.destination === `${temp}/x.cpp`);

console.log(`\nshell-copy-target: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
