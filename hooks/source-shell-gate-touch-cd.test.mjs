#!/usr/bin/env node
// source-shell-gate-touch-cd.test.mjs — a `cd` the gate cannot prove lands in an existing literal directory (no argument, ~, -,
// an option, a variable, a glob, a redirect, a CDPATH or HOME rebind, PowerShell set-location) cancels the touch lift
// (KIT-T1088). Split from source-shell-gate-touch.test.mjs so each suite finishes inside one foreground call (KIT-T1271).
// Run: node hooks/source-shell-gate-touch-cd.test.mjs

import { join } from 'node:path';
import { touchHarness } from './source-shell-gate-touch-harness.mjs';

const { repo, run, check, expectBlock, finish } = touchHarness();

try {
  const PS = 'PowerShell';
  const CD_BLOCK = [
    ['cd with no argument', 'cd && touch src/a.cpp'],
    ['cd with no argument then a semicolon', 'cd; touch src/a.cpp'],
    ['cd to the home directory', 'cd ~ && touch src/a.cpp'],
    ['cd to the previous directory', 'cd - && touch src/a.cpp'],
    ['cd with an option and no directory', 'cd -P && touch src/a.cpp'],
    ['cd with a double dash and no directory', 'cd -- && touch src/a.cpp'],
    ['cd with an option before the directory', 'cd -P src && touch src/a.cpp'],
    ['cd with two arguments (the shell refuses, the touch then runs where it started)', 'cd src extra; touch src/a.cpp'],
    ['the cmd /d form', 'cd /d src; touch a.cpp'],
    ['an escaped semicolon the two splitters read differently', 'echo \\; cd src && touch a.cpp'],
    ['cd to a missing directory', 'cd missing && touch src/a.cpp'],
    ['cd to a missing directory, semicolon', 'cd missing; touch src/a.cpp'],
    ['cd to a file', 'cd src/a.cpp; touch src/a.cpp'],
    ['cd to the parent', 'cd src/.. && touch src/a.cpp'],
    ['cd with a variable', 'D=src && cd $D && touch src/a.cpp'],
    ['cd with a glob', 'cd s* && touch src/a.cpp'],
    ['cd with a redirect', 'cd src > /dev/null && touch src/a.cpp'],
    ['an upper-case CD', 'CD src && touch src/a.cpp'],
    ['set-location', 'set-location src; touch src/a.cpp', PS],
    ['the sl alias', 'sl src; touch src/a.cpp', PS],
    ['a CDPATH assignment before the cd', 'CDPATH=src && cd lib && touch only.h'],
    ['a HOME assignment before a bare cd', 'HOME=src && cd && touch src/a.cpp'],
    ['an OLDPWD assignment before cd -', 'OLDPWD=src && cd - && touch src/a.cpp'],
    ['a PWD assignment', 'PWD=src && touch src/a.cpp'],
    ['an exported CDPATH', 'export CDPATH=src && cd lib && touch only.h'],
    ['a PowerShell env assignment', '$env:CDPATH = "src"; cd lib; touch only.h', PS],
    ['cd piped into the touch', 'cd src | touch a.cpp'],
    ['cd backgrounded before the touch', 'cd src & touch a.cpp'],
    ['a touch after an or-list cd', 'cd src || touch a.cpp'],
    ['a missing file in an existing directory', 'cd src && touch new.cpp'],
  ];
  for (const [name, command, tool] of CD_BLOCK) expectBlock(name, command, tool);
  const inherited = (command, env) => run(command, 'Bash', { ...process.env, ...env }).status;
  check('an inherited CDPATH blocks a bare relative cd', inherited('cd lib && touch only.h', { CDPATH: join(repo, 'src') }) === 2);
  check('an inherited CDPATH leaves a ./ cd alone', inherited('cd ./lib && touch only.h', { CDPATH: join(repo, 'src') }) === 0);
} finally {
  finish();
}
