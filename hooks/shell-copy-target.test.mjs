#!/usr/bin/env node
// shell-copy-target.test.mjs — KIT-T984: a cp/mv/Copy-Item judges the path it WRITES (the destination), read with
// quotes kept whole, so a backup copy of a source file into the scratchpad is no hand write; a copy or move that
// lands on a source path still is. A move is judged like a copy: its source leaves the tree, which no gate treats as authoring.
// Run: node hooks/shell-copy-target.test.mjs

import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { shellSourceWrite } from './lib/shell-source-write.mjs';

const HOOK = fileURLToPath(new URL('./source-shell-gate.mjs', import.meta.url));
let fails = 0;
let passes = 0;
const check = (name, cond, detail = '') => {
  if (cond) { passes++; console.log(`  ok    ${name}`); } else { fails++; console.log(`  FAIL  ${name} ${detail}`); }
};
const blocks = (name, command) => check(`blocks ${name}`, !!shellSourceWrite(command), command);
const allows = (name, command) => check(`allows ${name}`, shellSourceWrite(command) === null, command);

const temp = tmpdir().replace(/\\/g, '/');
const spaced = `${temp}/Chris Sparks/scratchpad`;
const msys = temp.replace(/^([A-Za-z]):\//, (_, d) => `/${d.toLowerCase()}/`);

const BACKUPS = [
  ['a copy into a quoted temp path holding a space', `cp src/a.cpp "${spaced}/a.cpp"`],
  ['a copy into a single-quoted temp path holding a space', `cp src/a.cpp '${spaced}/a.cpp'`],
  ['a copy into a temp path in the MSYS drive form', `cp src/a.cpp ${msys}/a.cpp`],
  ['a copy into a quoted temp path in the MSYS drive form with a space', `cp src/a.cpp "${msys}/Chris Sparks/a.cpp"`],
  ['cp -t to the temp dir', `cp -t ${temp} src/a.cpp`],
  ['cp --target-directory= to the temp dir', `cp --target-directory=${temp} src/a.cpp`],
  ['cp into a temp dir with a trailing slash', `cp -r src/a.cpp ${temp}/`],
  ['a copy with stderr merged', `cp src/a.cpp ${temp}/a.cpp 2>&1`],
  ['a copy with a joined -tDIR', `cp -t${temp} src/a.cpp`],
  ['a copy with a clustered -rt DIR', `cp -rt ${temp} src/a.cpp`],
  ['a copy with an abbreviated --target= ', `cp --target=${temp} src/a.cpp`],
  ['a copy with options after the operands', `cp src/a.cpp ${temp}/a.cpp -v`],
  ['a copy with a quoted > in a source name', `cp "src/a>b.cpp" ${temp}/a.cpp`],
  ['Copy-Item with a lower-case abbreviated -dest', `Copy-Item src/a.cpp -dest "${spaced}/a.cpp"`],
  ['Copy-Item with -Destination:value', `Copy-Item src/a.cpp -Destination:"${spaced}/a.cpp"`],
  ['Copy-Item with positional Path and Destination', `Copy-Item src/a.cpp "${spaced}/a.cpp"`],
  ['Copy-Item with -Destination', `Copy-Item src/a.cpp -Destination "${spaced}/a.cpp"`],
  ['Copy-Item with -Path and -Destination', `Copy-Item -Path src/a.cpp -Destination "${spaced}/a.cpp" -Force`],
];
for (const [name, command] of BACKUPS) allows(name, command);

const LANDS_ON_SOURCE = [
  ['a copy onto a source file', `cp ${temp}/x.cpp src/a.cpp`],
  ['a copy between source files', 'cp src/a.cpp src/b.cpp'],
  ['a move onto a source file', `mv ${temp}/x.cpp src/a.cpp`],
  ['a copy into a quoted repo path holding a space', 'cp a.cpp "my dir/b.cpp"'],
  ['cp -t into a source-named target', `cp -t src/a.cpp ${temp}/x.cpp`],
  ['a copy into a directory with a trailing slash, landing a source name', `cp ${temp}/x.cpp src/`],
  ['cp -t into a directory with a trailing slash, landing a source name', `cp -t src/ ${temp}/x.cpp`],
  ['cp --target-directory= with a trailing slash', `cp --target-directory=src/ ${temp}/x.cpp`],
  ['Copy-Item onto a source file', `Copy-Item ${temp}/x.cpp -Destination src/a.cpp`],
  ['a copy under a wrapper', `sudo -u root cp ${temp}/x.cpp src/a.cpp`],
  ['a copy onto a source file with stdout sent to the null device', `cp ${temp}/x.cpp src/a.cpp > /dev/null`],
  ['a copy onto a source file with stderr to a file', `cp ${temp}/x.cpp src/a.cpp 2> err.txt`],
  ['a copy onto a source file with a quoted redirect target', `cp ${temp}/x.cpp src/a.cpp >> "my log.txt"`],
  ['a copy onto a source file with stderr merged', `cp ${temp}/x.cpp src/a.cpp 2>&1`],
  ['a quoted > that is no redirect, then a source destination', `cp "${temp}/x>" ${temp}/a.cpp "src/"`],
  ['a quoted > in the first operand with a source last', `cp "${temp}/x>" src/a.cpp`],
  ['a joined -tDIR into the repo', `cp -tsrc/ ${temp}/x.cpp`],
  ['a clustered -rt DIR into the repo', `cp -rt src/ ${temp}/x.cpp`],
  ['an abbreviated --target= into the repo', `cp --target=src/ ${temp}/x.cpp`],
  ['--target-directory with a separate value into the repo', `cp --target-directory src/ ${temp}/x.cpp`],
  ['a -t with no value (destination unknown)', 'cp src/a.cpp src/b.cpp -t'],
  ['an option that may take a value after the operands (destination unknown)', `cp ${temp}/x.cpp src/a.cpp --sparse always`],
  ['an unknown short option (destination unknown)', `cp -Q ${temp}/x.cpp src/a.cpp`],
  ['Copy-Item with an upper-case -DESTINATION', `Copy-Item ${temp}/x.cpp -DESTINATION src/a.cpp`],
  ['Copy-Item with an unambiguous prefix -Dest', `Copy-Item ${temp}/x.cpp -Dest src/a.cpp`],
  ['Copy-Item with -Destination:value', `Copy-Item ${temp}/x.cpp -Destination:src/a.cpp`],
  ['Copy-Item with an ambiguous -De (destination unknown)', `Copy-Item ${temp}/x.cpp -De src/a.cpp`],
  ['Copy-Item with an extra parameter holding a value (destination unknown)', `Copy-Item ${temp}/x.cpp src/a.cpp -Filter *.cpp`],
  ['Copy-Item with a quoted destination in the repo', `Copy-Item ${temp}/x.cpp "my dir/a.cpp"`],
  ['a move onto a source file inside the repo', 'mv src/a.cpp src/a.cpp.bak'],
  ['a move whose destination is unresolved', 'mv src/a.cpp "$DEST/a.cpp.bak"'],
];
for (const [name, command] of LANDS_ON_SOURCE) blocks(name, command);
blocks('rm of a source file', 'rm src/a.cpp');
blocks('a rename in place onto a source name', 'rename a.cpp b.cpp');

const repo = mkdtempSync(join(tmpdir(), 'kit-copytarget-'));
execFileSync('git', ['init', '-q'], { cwd: repo });
mkdirSync(join(repo, '.ai'), { recursive: true });
const run = (command) => spawnSync(process.execPath, [HOOK], { cwd: repo, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command } }), encoding: 'utf8' });
check('the gate lets a quoted scratchpad backup of a source file through', run(`cp src/a.cpp "${spaced}/a.cpp"`).status === 0);
check('the gate still refuses a copy onto a source file in the repo', run(`cp ${temp}/x.cpp src/a.cpp`).status === 2);
check('the gate lets a source file move out to the temp dir', run(`mv src/a.cpp ${temp}/a.cpp`).status === 0);
check('the gate lets a source file move to a path outside any repo', run('mv src/a.cpp ../moved.bak').status === 0);
check('the gate refuses a move that stays in the repo', run('mv src/a.cpp src/a.cpp.bak').status === 2);
check('the gate refuses a move to a destination it cannot resolve', run('mv src/a.cpp "$DEST/a.bak"').status === 2);
check('the gate refuses a move onto a source file', run(`mv ${temp}/x.cpp src/a.cpp`).status === 2);

console.log(`\nshell-copy-target: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
